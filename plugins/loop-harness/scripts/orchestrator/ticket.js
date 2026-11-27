// Drives one ticket through the steps, then applies the outcome: labels, comments, notifications.
import { STEPS, readPlanText } from './steps.js';

const MAX_TRANSITIONS = 20;

export const advance = async (ctx, deps, from, until = null) => {
  const walk = async (state, step, count) => {
    if (step === until) return { paused: step, ctx: state };
    if (count >= MAX_TRANSITIONS) return { stop: 'blocked', ctx: { ...state, reason: 'too many transitions' } };
    const result = await STEPS[step](state, deps);
    return result.stop ? result : walk(result.ctx, result.next, count + 1);
  };
  try {
    return await walk(ctx, from, 0);
  } catch (error) {
    return { stop: 'blocked', ctx: { ...ctx, reason: `orchestrator error: ${error.message}` } };
  }
};

const findingsList = (ctx) => (ctx.findings ?? []).map((f) => `- [${f.severity}] ${f.file}: ${f.message}`).join('\n');

const hotfixBody = (ctx, deps) => [
  `Deploy failed after merging #${ctx.issue.number} (${ctx.prUrl}).`,
  '',
  ...ctx.deployFailures.map((f) => `Target ${f.name}:\n\`\`\`\n${f.output}\n\`\`\``),
  '',
  '## Acceptance criteria',
  '- The deployment of main is healthy again',
  '- A COE is written in docs/coe/',
  '',
  `Merge: ${ctx.mergeSha}`,
  `Sensitive: ${(ctx.planReasons ?? []).length > 0 ? 'yes' : 'no'}`,
  `Timeout: ${deps.settings.hotfixTimeoutMinutes} minutes`,
].join('\n');

export const OUTCOMES = {
  blocked: async (ctx, deps) => {
    deps.gh.comment(ctx.issue.number, `Blocked: ${ctx.reason}\n${findingsList(ctx)}\n\nRelabel loop:ready to retry.`);
    deps.gh.setStatus(ctx.issue.number, 'loop:blocked');
    await deps.notify('blocked', { title: `Blocked #${ctx.issue.number}`, message: ctx.reason });
    if (ctx.issue.labels.includes('hotfix')) await deps.revert(ctx);
  },
  question: async (ctx, deps) => {
    deps.gh.comment(ctx.issue.number, `Questions before planning:\n${ctx.questions.map((q) => `- ${q}`).join('\n')}\n\nAnswer here, then relabel loop:ready.`);
    deps.gh.setStatus(ctx.issue.number, 'loop:question');
    await deps.notify('question', { title: `Question on #${ctx.issue.number}`, message: ctx.questions.join('\n') });
  },
  'awaiting-plan': async (ctx, deps) => {
    deps.gh.comment(ctx.issue.number, `Plan needs your validation:\n${ctx.planReasons.map((r) => `- ${r}`).join('\n')}\n\n${readPlanText(ctx)}\n\nMockup: ${ctx.plan.mockup ?? 'none'}\n\nApprove: add label loop:plan-approved. Change: comment, then relabel loop:ready.`);
    deps.gh.setStatus(ctx.issue.number, 'loop:awaiting-plan');
    await deps.notify('plan-awaiting', { title: `Plan to validate #${ctx.issue.number}`, message: ctx.planReasons.join('\n') });
  },
  'awaiting-review': async (ctx, deps) => {
    deps.gh.comment(ctx.issue.number, `Pull request ready for your review: ${ctx.prUrl}\n${ctx.gate.reasons.map((r) => `- ${r}`).join('\n')}`);
    deps.gh.setStatus(ctx.issue.number, 'loop:awaiting-review');
    await deps.notify('review-requested', { title: `Review #${ctx.issue.number}`, message: ctx.prUrl, url: ctx.prUrl });
  },
  done: async (ctx, deps) => {
    deps.gh.setStatus(ctx.issue.number, 'loop:done');
    const event = ctx.issue.labels.includes('hotfix') ? 'deploy-restored' : 'merged';
    await deps.notify(event, { title: `Merged #${ctx.issue.number}`, message: ctx.prUrl, url: ctx.prUrl });
  },
  'deploy-failed': async (ctx, deps) => {
    deps.gh.setStatus(ctx.issue.number, 'loop:done');
    const hotfix = deps.gh.createIssue({ title: `fix(deploy): repair deploy after #${ctx.issue.number}`, body: hotfixBody(ctx, deps), labels: ['loop:ready', 'hotfix'] });
    deps.gh.comment(ctx.issue.number, `Deploy failed after merge. Hotfix ticket: #${hotfix}`);
    await deps.notify('deploy-failed', { title: 'Deploy failed, fix in progress', message: `Hotfix #${hotfix} for #${ctx.issue.number}` });
  },
};

// Cleanup never fails a ticket: a leftover worktree is logged, not fatal.
const cleanup = (ctx, deps) => {
  try {
    deps.git.removeWorktree(ctx.worktree);
  } catch (error) {
    deps.log(ctx, 'cleanup', { ok: false, error: error.message });
  }
};

export const finish = async (result, deps) => {
  deps.log(result.ctx, 'outcome', { outcome: result.stop, reason: result.ctx.reason });
  await OUTCOMES[result.stop](result.ctx, deps);
  if (result.ctx.worktree) cleanup(result.ctx, deps);
  return { number: result.ctx.issue.number, outcome: result.stop, cost: result.ctx.cost };
};
