import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globToRegExp, matchesAny } from './glob.js';
import { planGate, mergeGate } from './risk.js';
import { conflictsWith, schedule } from './overlap.js';
import { agentArgs, parseAgentOutput, runAgent } from './agent.js';
import { SCHEMAS, blocking } from './schemas.js';

const config = { sensitivePaths: ['src/models/**', 'src/middlewares/auth*'], coreBusinessPaths: ['src/services/sale*'], coreBusinessLabels: ['core-business'], autoMerge: true };

test('glob matching', () => {
  assert.ok(globToRegExp('src/models/**').test('src/models/user/user.model.ts'));
  assert.ok(globToRegExp('src/middlewares/auth*').test('src/middlewares/auth.middleware.ts'));
  assert.ok(!globToRegExp('src/*.ts').test('src/a/b.ts'));
  assert.ok(matchesAny('.env.local', ['.env*']));
  assert.ok(matchesAny('apps/api/.env', ['**/.env*']));
  assert.ok(!matchesAny('src/environment.ts', ['.env*', '**/.env*']));
});

test('plan gate: plain plan goes to the plan reviewer', () => {
  const plan = { files: ['src/services/expense.service.ts'], triggers: {} };
  assert.deepEqual(planGate({ plan, issue: { labels: [] }, config }), { human: false, reasons: [] });
});

test('plan gate: triggers, sensitive paths, core business paths and labels go to the human', () => {
  const plan = { files: ['src/models/sale.model.ts', 'src/services/sale.service.ts'], triggers: { thirdParty: true } };
  const gate = planGate({ plan, issue: { labels: ['core-business'] }, config });
  assert.equal(gate.human, true);
  assert.deepEqual(gate.reasons.sort(), [
    'core business path: src/services/sale.service.ts',
    'label: core-business',
    'planner: third-party integration',
    'sensitive path: src/models/sale.model.ts',
  ]);
});

test('merge gate: risk only goes up', () => {
  assert.deepEqual(mergeGate({ changedFiles: ['src/services/expense.service.ts'], config }), { risk: 'low', reasons: [] });
  assert.equal(mergeGate({ changedFiles: ['src/a.ts'], planReasons: ['planner: core business'], config }).risk, 'sensitive');
  assert.equal(mergeGate({ changedFiles: ['package.json'], config }).risk, 'sensitive');
  assert.equal(mergeGate({ changedFiles: ['.github/workflows/ci.yml'], config }).risk, 'sensitive');
  assert.equal(mergeGate({ changedFiles: ['src/a.ts'], config, breakingApi: true }).risk, 'sensitive');
  assert.deepEqual(mergeGate({ changedFiles: ['src/a.ts'], config: { ...config, autoMerge: false } }).reasons, ['auto-merge disabled (phase 1)']);
});

test('overlap: conflicting tickets wait, parallel limit holds', () => {
  const planned = [
    { number: 1, files: ['a.ts', 'b.ts'] },
    { number: 2, files: ['b.ts'] },
    { number: 3, files: ['c.ts'] },
    { number: 4, files: ['d.ts'] },
  ];
  const { run, wait } = schedule(planned, 2);
  assert.deepEqual(run.map((t) => t.number), [1, 3]);
  assert.deepEqual(wait.map((t) => [t.number, t.waitingFor]), [[2, [1]], [4, []]]);
  assert.deepEqual(conflictsWith(['x.ts'], run), []);
});

test('agent args use the plugin agent, schema, unattended permissions and budget', () => {
  const args = agentArgs({ agent: 'planner', prompt: 'P', settings: { permissionMode: 'auto', budgetUsd: 3 } });
  assert.deepEqual(args.slice(0, 3), ['-p', '--agent', 'loop-harness:planner']);
  assert.ok(args.includes('--permission-prompts') && args.includes('none'));
  assert.equal(args[args.indexOf('--max-budget-usd') + 1], '3');
  assert.deepEqual(JSON.parse(args[args.indexOf('--json-schema') + 1]), SCHEMAS.planner);
  assert.equal(args.at(-1), 'P');
});

test('agent output: structured output, fenced fallback, errors', async () => {
  const structured = parseAgentOutput(JSON.stringify({ structured_output: { verdict: 'approve', findings: [] }, total_cost_usd: 0.4 }));
  assert.deepEqual(structured, { ok: true, output: { verdict: 'approve', findings: [] }, cost: 0.4, usage: [], limited: false });
  const fenced = parseAgentOutput(JSON.stringify({ result: 'Done.\n```json\n{"status":"done"}\n```' }));
  assert.deepEqual(fenced.output, { status: 'done' });
  assert.equal(parseAgentOutput(JSON.stringify({ is_error: true, result: 'Budget limit reached' })).ok, false);
  const crashed = await runAgent(async () => { throw Object.assign(new Error('boom'), { stderr: 'not logged in' }); })({ agent: 'planner', prompt: '', cwd: '.', settings: { permissionMode: 'auto', budgetUsd: 1 } });
  assert.deepEqual(crashed, { ok: false, error: 'not logged in', cost: 0, usage: [], limited: false });
});

test('blocking findings are blockers and majors', () => {
  const findings = [{ severity: 'minor' }, { severity: 'major' }, { severity: 'blocker' }];
  assert.equal(blocking({ findings }).length, 2);
});
