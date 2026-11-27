// One function per pipeline step. Each returns { next, ctx } or { stop, ctx }.
// ctx: { issue, run, plan, gate, branch, worktree, reviews, cost } ; deps: injected adapters.
import { readFileSync } from 'node:fs';
import { PROMPTS, prBody, prTitle } from './prompts.js';
import { planGate, mergeGate } from './risk.js';
import { blocking } from './schemas.js';
import { branchFor } from './git.js';

const REVIEWERS = ['code-reviewer', 'spec-reviewer', 'security-reviewer'];

const call = async (deps, ctx, agent, prompt, cwd) => {
  const before = deps.quota.check();
  if (before.pause) return { result: { ok: false, paused: before }, cost: ctx.cost };
  const result = await deps.runAgent({ agent, prompt, cwd, settings: deps.settings.agent });
  const after = deps.quota.record(result.usage ?? []);
  const cost = ctx.cost + result.cost;
  deps.log(ctx, agent, { ok: result.ok, cost: result.cost, output: result.output, error: result.error, quota: after });
  if (result.limited) return { result: { ok: false, paused: { ...after, pause: true, reason: after.reason ?? 'usage limit reached' } }, cost };
  if (cost > deps.settings.budgetUsdPerTicket) return { result: { ok: false, error: `ticket budget exceeded (${cost.toFixed(2)} USD)` }, cost };
  return { result, cost };
};

export const blocked = (ctx, reason) => ({ stop: 'blocked', ctx: { ...ctx, reason } });

// An agent call that did not succeed: paused by the quota guard, or blocked.
const failed = (ctx, result, label) =>
  result.paused ? { stop: 'paused', ctx: { ...ctx, pause: result.paused } } : blocked(ctx, `${label}: ${result.error}`);

export const plan = async (ctx, deps) => {
  if (ctx.issue.labels.includes('loop:plan-approved') && deps.store.hasPlan(ctx)) {
    const saved = deps.store.readPlan(ctx);
    const { reasons } = planGate({ plan: saved, issue: ctx.issue, config: deps.settings.risk });
    return { next: 'build', ctx: { ...ctx, plan: saved, planReasons: reasons, planApproved: true } };
  }
  deps.gh.setStatus(ctx.issue.number, 'loop:planning');
  const { result, cost } = await call(deps, ctx, 'planner', PROMPTS.planner(ctx), deps.repoDir);
  const next = { ...ctx, cost };
  if (!result.ok) return failed(next, result, 'planner failed');
  if (result.output.questions.length > 0) return { stop: 'question', ctx: { ...next, questions: result.output.questions } };
  deps.store.savePlan(next, result.output);
  return { next: 'planGate', ctx: { ...next, plan: result.output } };
};

export const gatePlan = async (ctx, deps) => {
  const gate = planGate({ plan: ctx.plan, issue: ctx.issue, config: deps.settings.risk });
  if (gate.human) return { stop: 'awaiting-plan', ctx: { ...ctx, planReasons: gate.reasons } };
  const { result, cost } = await call(deps, ctx, 'plan-reviewer', PROMPTS['plan-reviewer'](ctx), deps.repoDir);
  const next = { ...ctx, cost };
  if (!result.ok) return failed(next, result, 'plan reviewer failed');
  const verdicts = {
    approve: () => ({ next: 'build', ctx: { ...next, adr: result.output.adr, planApproved: true } }),
    escalate: () => ({ stop: 'awaiting-plan', ctx: { ...next, planReasons: ['plan reviewer escalated'] } }),
    changes: () => (next.planRounds ?? 0) + 1 >= deps.settings.maxReviewIterations
      ? blocked(next, `plan rejected ${deps.settings.maxReviewIterations} times`)
      : { next: 'plan', ctx: { ...next, planRounds: (next.planRounds ?? 0) + 1, feedback: blocking(result.output) } },
  };
  return verdicts[result.output.verdict]();
};

export const build = async (ctx, deps) => {
  const branch = branchFor(ctx.issue);
  const worktree = deps.git.createWorktree({ path: deps.store.worktreePath(ctx), branch });
  deps.gh.setStatus(ctx.issue.number, 'loop:in-progress');
  const { result, cost } = await call(deps, ctx, 'builder', PROMPTS.builder({ ...ctx, branch }), worktree);
  const next = { ...ctx, cost, branch, worktree };
  if (!result.ok) return failed(next, result, 'builder failed');
  return result.output.status === 'blocked' ? blocked(next, `builder blocked: ${result.output.blocker}`) : { next: 'review', ctx: next };
};

const runReviewers = (ctx, deps) =>
  REVIEWERS.reduce(async (previous, agent) => {
    const state = await previous;
    const { result, cost } = await call(deps, { ...ctx, cost: state.cost }, agent, PROMPTS.reviewer(ctx), ctx.worktree);
    return { cost, reviews: [...state.reviews, { agent, ...result }] };
  }, Promise.resolve({ cost: ctx.cost, reviews: [] }));

export const review = async (ctx, deps) => {
  const { cost, reviews } = await runReviewers(ctx, deps);
  const next = { ...ctx, cost, reviews };
  const broken = reviews.find((r) => !r.ok);
  if (broken) return failed(next, broken, `${broken.agent} failed`);
  const findings = reviews.flatMap((r) => blocking(r.output));
  if (findings.length === 0) return { next: 'ship', ctx: next };
  const rounds = (ctx.reviewRounds ?? 0) + 1;
  if (rounds >= deps.settings.maxReviewIterations) return blocked({ ...next, findings }, `review not clean after ${rounds} rounds`);
  const fix = await call(deps, next, 'builder', PROMPTS.builder({ ...next, findings }), ctx.worktree);
  if (!fix.result.ok) return failed({ ...next, cost: fix.cost }, fix.result, 'builder fix failed');
  return { next: 'review', ctx: { ...next, cost: fix.cost, reviewRounds: rounds } };
};

export const ship = async (ctx, deps) => {
  const changedFiles = deps.git.changedFiles(ctx.worktree);
  const gate = mergeGate({ changedFiles, planReasons: ctx.planReasons ?? [], config: deps.settings.risk });
  deps.git.push(ctx.worktree, ctx.branch);
  const sensitive = gate.risk === 'sensitive';
  const url = deps.gh.openPr({
    branch: ctx.branch, title: prTitle(ctx.issue, ctx.branch),
    body: prBody({ issue: ctx.issue, gate, reviews: ctx.reviews }), reviewer: sensitive ? deps.settings.reviewer : null,
  });
  const next = { ...ctx, gate, prUrl: url };
  if (sensitive) return { stop: 'awaiting-review', ctx: next };
  const checks = deps.gh.waitChecks(url);
  if (!checks.ok) return blocked(next, `CI failed on ${url}:\n${checks.output}`);
  return { next: 'deploy', ctx: { ...next, mergeSha: deps.gh.mergePr(url) } };
};

export const deploy = async (ctx, deps) => {
  const result = await deps.checkDeploy();
  return result.ok ? { stop: 'done', ctx } : { stop: 'deploy-failed', ctx: { ...ctx, deployFailures: result.failures } };
};

export const readPlanText = (ctx) => {
  try {
    return readFileSync(ctx.plan.plan, 'utf8');
  } catch {
    return `Plan file not found: ${ctx.plan?.plan}`;
  }
};

export const STEPS = { plan, planGate: gatePlan, build, review, ship, deploy };
