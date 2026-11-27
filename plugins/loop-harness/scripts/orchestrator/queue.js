// One pass over the ticket queue: plan up to maxParallel tickets, schedule by file overlap, build in parallel.
import { advance, finish } from './ticket.js';
import { schedule } from './overlap.js';

const IN_FLIGHT = ['loop:planning', 'loop:in-progress'];

// Only one orchestrator runs per repository (lock), so in-flight labels at start come from an interrupted run.
export const recoverInterrupted = (deps) =>
  IN_FLIGHT.flatMap((label) => deps.gh.listByLabel(label)).map((number) => {
    deps.gh.comment(number, 'The loop was interrupted on this ticket. Relabel loop:ready to retry.');
    deps.gh.setStatus(number, 'loop:blocked');
    return number;
  });

const depsFor = (issue, deps) =>
  issue.labels.includes('hotfix')
    ? { ...deps, settings: { ...deps.settings, agent: { ...deps.settings.agent, timeoutMs: deps.settings.hotfixTimeoutMinutes * 60000 } } }
    : deps;

const planAll = (issues, deps) =>
  issues.reduce(async (previous, issue) => {
    const state = await previous;
    if (deps.quota.check().pause) return state;
    const ticketDeps = depsFor(issue, deps);
    const result = await advance({ issue, run: deps.store.runFor(issue), cost: 0 }, ticketDeps, 'plan', 'build');
    return result.paused
      ? { ...state, planned: [...state.planned, { number: issue.number, files: result.ctx.plan.files, ctx: result.ctx }] }
      : { ...state, finished: [...state.finished, await finish(result, ticketDeps)] };
  }, Promise.resolve({ planned: [], finished: [] }));

const defer = (ticket, deps) => {
  deps.gh.comment(ticket.number, `Plan approved. Waiting for #${ticket.waitingFor.join(', #')} (shared files).`);
  deps.gh.setStatus(ticket.number, 'loop:plan-approved');
  return { number: ticket.number, outcome: 'deferred' };
};

export const runOnce = async (deps) => {
  const quota = deps.quota.check();
  if (quota.pause) return { skipped: 'quota', ...quota };
  const recovered = recoverInterrupted(deps);
  const issues = deps.gh.listReady().slice(0, deps.settings.maxParallel);
  const { planned, finished } = await planAll(issues, deps);
  const { run, wait } = schedule(planned, deps.settings.maxParallel);
  const built = await Promise.all(run.map(async (ticket) => {
    const ticketDeps = depsFor(ticket.ctx.issue, deps);
    return finish(await advance(ticket.ctx, ticketDeps, 'build'), ticketDeps);
  }));
  return { recovered, results: [...finished, ...built, ...wait.map((ticket) => defer(ticket, deps))] };
};
