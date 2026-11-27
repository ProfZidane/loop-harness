import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOnce } from './queue.js';
import { store } from './store.js';
import { revert, revertPlan } from './revert.js';
import { readSettings, inWindow } from './settings.js';

const template = readFileSync(join(import.meta.dirname, '..', '..', 'templates', 'loop.config.yml'), 'utf8');

const approve = { verdict: 'approve', findings: [] };
const major = { verdict: 'changes', findings: [{ severity: 'major', file: 'src/a.ts', line: 1, rule: 'core.md 2', message: 'use a dictionary' }] };
const planOut = (files, triggers = {}) => ({ plan: '/tmp/plan.md', files, mockup: null, triggers: { sensitive: false, coreBusiness: false, thirdParty: false, tradeOff: false, ...triggers }, questions: [] });
const issue = (number, extra = {}) => ({ number, title: `feat(app): ticket ${number}`, body: 'Do it', labels: ['loop:ready'], createdAt: `2026-11-27T0${number}:00:00Z`, ...extra });

// Scripted agent outputs per ticket number and agent name, consumed in order.
const fakeAgents = (script, calls) => async ({ agent, prompt }) => {
  const number = Number(/Ticket #(\d+)/.exec(prompt)?.[1]);
  calls.push({ agent, number, prompt });
  const queue = script[number]?.[agent] ?? [];
  const output = queue.length > 1 ? queue.shift() : queue[0];
  return output === undefined ? { ok: false, error: `no script for ${agent}`, cost: 0 } : { ok: true, output, cost: 0.5 };
};

const fakeGh = (issues, calls, { checksOk = true, inFlight = {} } = {}) => ({
  ensureLabels: () => {},
  listReady: () => issues,
  listByLabel: (label) => inFlight[label] ?? [],
  setStatus: (number, status) => calls.push(['status', number, status]),
  comment: (number, body) => calls.push(['comment', number, body]),
  createIssue: (spec) => { calls.push(['createIssue', spec]); return 99; },
  openPr: (spec) => { calls.push(['openPr', spec]); return `https://github.com/o/r/pull/${spec.branch.split('/')[1].split('-')[0]}`; },
  waitChecks: () => (checksOk ? { ok: true } : { ok: false, output: 'lint failed' }),
  mergePr: (url) => { calls.push(['merge', url]); return 'abc1234def'; },
});

const fakeGit = (files, calls) => ({
  createWorktree: ({ path }) => path,
  removeWorktree: (path) => calls.push(['removeWorktree', path]),
  changedFiles: () => files,
  push: (path, branch) => calls.push(['push', branch]),
  revertCommit: (spec) => { calls.push(['revertCommit', spec.sha]); return spec.path; },
});

const setup = ({ issues, script, changed = ['src/services/a.service.ts'], config = {}, gh = {}, deployOk = true }) => {
  const calls = { agents: [], gh: [], git: [], notify: [] };
  const settings = readSettings(template);
  const deps = {
    repoDir: '/repo',
    settings: { ...settings, risk: { ...settings.risk, ...config } },
    store: store({ home: mkdtempSync(join(tmpdir(), 'loop-')), repoName: 'repo', now: () => new Date(0) }),
    runAgent: fakeAgents(script, calls.agents),
    gh: fakeGh(issues, calls.gh, gh),
    git: fakeGit(changed, calls.git),
    notify: async (event, payload) => { calls.notify.push(event); return payload; },
    checkDeploy: async () => (deployOk ? { ok: true, failures: [] } : { ok: false, failures: [{ name: 'railway', output: 'crash' }] }),
  };
  deps.quota = { check: () => ({ pause: false }), record: () => ({ pause: false }) };
  deps.log = deps.store.log;
  deps.revert = async (ctx) => { calls.notify.push('revert'); return ctx; };
  return { deps, calls };
};

const happy = (files = ['src/services/a.service.ts']) => ({
  planner: [planOut(files)], 'plan-reviewer': [approve], builder: [{ status: 'done', commits: ['c1'], docs: [], blocker: null }],
  'code-reviewer': [approve], 'spec-reviewer': [approve], 'security-reviewer': [approve],
});

const statuses = (calls, number) => calls.gh.filter(([kind, n]) => kind === 'status' && n === number).map(([, , s]) => s);

test('phase 2: low-risk ticket is planned, built, reviewed, merged and deployed', async () => {
  const { deps, calls } = setup({ issues: [issue(1)], script: { 1: happy() }, config: { autoMerge: true } });
  const { results } = await runOnce(deps);
  assert.deepEqual(results, [{ number: 1, outcome: 'done', cost: 3 }]);
  assert.deepEqual(statuses(calls, 1), ['loop:planning', 'loop:in-progress', 'loop:done']);
  assert.deepEqual(calls.agents.map((c) => c.agent), ['planner', 'plan-reviewer', 'builder', 'code-reviewer', 'spec-reviewer', 'security-reviewer']);
  const pr = calls.gh.find(([kind]) => kind === 'openPr')[1];
  assert.equal(pr.reviewer, null);
  assert.equal(pr.title, 'feat(app): ticket 1');
  assert.ok(calls.gh.some(([kind]) => kind === 'merge'));
  assert.deepEqual(calls.notify, ['merged']);
});

test('phase 1: every ticket ends in a pull request for the owner', async () => {
  const { deps, calls } = setup({ issues: [issue(1)], script: { 1: happy() } });
  const { results } = await runOnce(deps);
  assert.equal(results[0].outcome, 'awaiting-review');
  assert.equal(calls.gh.find(([kind]) => kind === 'openPr')[1].reviewer, 'your-github-login');
  assert.ok(!calls.gh.some(([kind]) => kind === 'merge'));
  assert.deepEqual(calls.notify, ['review-requested']);
});

test('planner questions stop the ticket', async () => {
  const script = { 1: { planner: [{ ...planOut([]), questions: ['Which currency?'] }] } };
  const { deps, calls } = setup({ issues: [issue(1)], script });
  const { results } = await runOnce(deps);
  assert.equal(results[0].outcome, 'question');
  assert.deepEqual(statuses(calls, 1).at(-1), 'loop:question');
  assert.ok(calls.gh.some(([kind, , body]) => kind === 'comment' && body.includes('Which currency?')));
});

test('sensitive plan waits for the human, no code is written', async () => {
  const { deps, calls } = setup({ issues: [issue(1)], script: { 1: happy(['src/models/sale.model.ts']) }, config: { sensitivePaths: ['src/models/**'] } });
  const { results } = await runOnce(deps);
  assert.equal(results[0].outcome, 'awaiting-plan');
  assert.deepEqual(calls.agents.map((c) => c.agent), ['planner']);
  assert.deepEqual(calls.notify, ['plan-awaiting']);
});

test('human-approved plan is resumed without replanning and stays sensitive', async () => {
  const { deps, calls } = setup({ issues: [issue(1)], script: { 1: happy(['src/models/sale.model.ts']) }, config: { sensitivePaths: ['src/models/**'], autoMerge: true } });
  await runOnce(deps);
  deps.gh.listReady = () => [issue(1, { labels: ['loop:plan-approved'] })];
  const { results } = await runOnce(deps);
  assert.equal(results[0].outcome, 'awaiting-review');
  assert.deepEqual(calls.agents.filter((c) => c.agent === 'planner').length, 1);
});

test('review findings are fixed, then the ticket ships', async () => {
  const script = { 1: { ...happy(), 'code-reviewer': [major, approve], builder: [{ status: 'done', commits: [], docs: [], blocker: null }] } };
  const { deps, calls } = setup({ issues: [issue(1)], script, config: { autoMerge: true } });
  const { results } = await runOnce(deps);
  assert.equal(results[0].outcome, 'done');
  const fix = calls.agents.filter((c) => c.agent === 'builder')[1];
  assert.ok(fix.prompt.includes('Fix mode') && fix.prompt.includes('use a dictionary'));
});

test('review never clean: blocked after max iterations', async () => {
  const script = { 1: { ...happy(), 'security-reviewer': [major] } };
  const { deps, calls } = setup({ issues: [issue(1)], script });
  const { results } = await runOnce(deps);
  assert.equal(results[0].outcome, 'blocked');
  assert.equal(calls.agents.filter((c) => c.agent === 'security-reviewer').length, 3);
  assert.deepEqual(calls.notify, ['blocked']);
});

test('tickets sharing files: one builds, the other waits with its plan approved', async () => {
  const script = { 1: happy(['src/a.ts']), 2: happy(['src/a.ts']), 3: happy(['src/b.ts']) };
  const { deps, calls } = setup({ issues: [issue(1), issue(2), issue(3)], script });
  const { results } = await runOnce(deps);
  assert.deepEqual(results.map((r) => [r.number, r.outcome]).sort(), [[1, 'awaiting-review'], [2, 'deferred'], [3, 'awaiting-review']]);
  assert.deepEqual(statuses(calls, 2).at(-1), 'loop:plan-approved');
});

test('failed CI blocks the merge', async () => {
  const { deps } = setup({ issues: [issue(1)], script: { 1: happy() }, config: { autoMerge: true }, gh: { checksOk: false } });
  assert.equal((await runOnce(deps)).results[0].outcome, 'blocked');
});

test('failed deploy opens a hotfix ticket with the merge commit', async () => {
  const { deps, calls } = setup({ issues: [issue(1)], script: { 1: happy() }, config: { autoMerge: true }, deployOk: false });
  const { results } = await runOnce(deps);
  assert.equal(results[0].outcome, 'deploy-failed');
  const hotfix = calls.gh.find(([kind]) => kind === 'createIssue')[1];
  assert.deepEqual(hotfix.labels, ['loop:ready', 'hotfix']);
  assert.match(hotfix.body, /^Merge: abc1234def$/m);
  assert.match(hotfix.body, /^Sensitive: no$/m);
  assert.deepEqual(calls.notify, ['deploy-failed']);
});

test('blocked hotfix triggers the revert', async () => {
  const hotfix = issue(5, { labels: ['loop:ready', 'hotfix'], body: 'Merge: abc1234def\nSensitive: no' });
  const { deps, calls } = setup({ issues: [hotfix], script: { 5: { planner: [planOut(['src/a.ts'])], 'plan-reviewer': [approve] } } });
  await runOnce(deps);
  assert.ok(calls.notify.includes('revert'));
});

test('revert: reverts non-sensitive merges, never sensitive ones', async () => {
  assert.deepEqual(revertPlan({ body: 'Merge: abc1234\nSensitive: yes' }), { sha: 'abc1234', sensitive: true });
  const { deps, calls } = setup({ issues: [], script: {} });
  const done = await revert(deps)({ issue: { number: 5, body: 'Merge: abc1234def\nSensitive: no' } });
  assert.equal(done.reverted, true);
  assert.ok(calls.git.some(([kind, sha]) => kind === 'revertCommit' && sha === 'abc1234def'));
  const kept = await revert(deps)({ issue: { number: 6, body: 'Merge: abc1234def\nSensitive: yes' } });
  assert.deepEqual(kept, { reverted: false, reason: 'sensitive merge' });
});

test('ticket budget stops the run', async () => {
  const { deps } = setup({ issues: [issue(1)], script: { 1: happy() } });
  deps.settings.budgetUsdPerTicket = 1;
  const { results } = await runOnce(deps);
  assert.equal(results[0].outcome, 'blocked');
});

test('interrupted tickets are marked blocked at start', async () => {
  const { deps, calls } = setup({ issues: [], script: {}, gh: { inFlight: { 'loop:in-progress': [7] } } });
  const { recovered } = await runOnce(deps);
  assert.deepEqual(recovered, [7]);
  assert.deepEqual(statuses(calls, 7), ['loop:blocked']);
});

test('a failing worktree cleanup does not fail the run', async () => {
  const { deps } = setup({ issues: [issue(1)], script: { 1: happy() } });
  deps.git.removeWorktree = () => { throw new Error('busy'); };
  assert.equal((await runOnce(deps)).results[0].outcome, 'awaiting-review');
});

test('quota at the limit before a run: nothing starts', async () => {
  const { deps, calls } = setup({ issues: [issue(1)], script: { 1: happy() } });
  deps.quota.check = () => ({ pause: true, until: '2026-11-27T16:40:00.000Z', reason: 'five_hour at 91%' });
  const result = await runOnce(deps);
  assert.equal(result.skipped, 'quota');
  assert.deepEqual(calls.agents, []);
  assert.deepEqual(calls.gh, []);
});

test('quota reached during a ticket: paused and requeued, never blocked', async () => {
  const { deps, calls } = setup({ issues: [issue(1)], script: { 1: happy() } });
  const pauseAfterReviewer = { count: 0 };
  deps.quota.check = () => ({ pause: pauseAfterReviewer.count >= 2, until: '2026-11-27T16:40:00.000Z', reason: 'seven_day at 90%' });
  deps.quota.record = () => { pauseAfterReviewer.count += 1; return { pause: false }; };
  const { results } = await runOnce(deps);
  assert.equal(results[0].outcome, 'paused');
  assert.deepEqual(statuses(calls, 1).at(-1), 'loop:plan-approved');
  assert.ok(calls.gh.some(([kind, , body]) => kind === 'comment' && body.includes('seven_day at 90%')));
  assert.ok(!calls.git.some(([kind]) => kind === 'removeWorktree'), 'worktree kept for resume');
  assert.deepEqual(calls.notify, ['quota']);
});

test('usage limit hit inside an agent run pauses the ticket', async () => {
  const { deps, calls } = setup({ issues: [issue(1)], script: {} });
  deps.runAgent = async () => ({ ok: false, error: 'Claude usage limit reached', cost: 0, usage: [], limited: true });
  const { results } = await runOnce(deps);
  assert.equal(results[0].outcome, 'paused');
  assert.deepEqual(statuses(calls, 1).at(-1), 'loop:ready');
});

test('settings and time window', () => {
  const settings = readSettings(template);
  assert.equal(settings.maxParallel, 3);
  assert.equal(settings.risk.autoMerge, false);
  assert.equal(settings.agent.permissionMode, 'auto');
  assert.deepEqual(settings.deploy.checks, []);
  assert.equal(settings.deploy.attempts, 30);
  assert.deepEqual(settings.quota, { five_hour: 90, seven_day: 90 });
  assert.ok(inWindow('22:00-07:00', new Date('2026-11-27T23:30:00')));
  assert.ok(!inWindow('22:00-07:00', new Date('2026-11-27T12:00:00')));
  assert.ok(inWindow(null, new Date()));
});
