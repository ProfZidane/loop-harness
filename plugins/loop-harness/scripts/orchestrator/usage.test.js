import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshotFrom, snapshotsFromStream, mergeUsage, decide, quotaGuard, usageStore } from './usage.js';
import { parseAgentOutput } from './agent.js';

const now = new Date('2026-11-27T12:00:00Z');
const later = Math.floor(new Date('2026-11-27T15:00:00Z').getTime() / 1000);
const stopAt = { five_hour: 90, seven_day: 90 };

test('snapshots normalize fractions, percents, epochs and window names', () => {
  assert.deepEqual(snapshotFrom({ status: 'allowed', utilization: 0.42, resetsAt: later, rateLimitType: 'five_hour' }),
    { window: 'five_hour', percent: 42, resetsAt: '2026-11-27T15:00:00.000Z', status: 'allowed' });
  assert.equal(snapshotFrom({ utilization: 93, rateLimitType: 'seven_day' }).percent, 93);
  assert.equal(snapshotFrom({ status: 'rejected', rateLimitType: 'five_hour' }).percent, 100);
  assert.equal(snapshotFrom({ rateLimitType: 'unknown_window' }), null);
  assert.equal(snapshotFrom(null), null);
});

test('decide: pauses at the threshold, until the latest reset', () => {
  const usage = mergeUsage({}, [
    { window: 'five_hour', percent: 91, resetsAt: '2026-11-27T15:00:00.000Z', status: 'allowed_warning' },
    { window: 'seven_day', percent: 40, resetsAt: '2026-12-01T00:00:00.000Z', status: 'allowed' },
  ], now);
  assert.deepEqual(decide(usage, stopAt, now), { pause: true, until: '2026-11-27T15:00:00.000Z', reason: 'five_hour at 91%' });
  assert.equal(decide(usage, { five_hour: 95, seven_day: 90 }, now).pause, false);
});

test('decide: a warning without a percentage is treated as over the limit', () => {
  const usage = mergeUsage({}, [{ window: 'seven_day', percent: null, resetsAt: null, status: 'allowed_warning' }], now);
  assert.equal(decide(usage, stopAt, now).pause, true);
});

test('windows past their reset are forgotten', () => {
  const usage = mergeUsage({}, [{ window: 'five_hour', percent: 99, resetsAt: '2026-11-27T11:00:00.000Z', status: 'allowed' }], now);
  assert.deepEqual(usage.windows, {});
  assert.equal(decide(usage, stopAt, now).pause, false);
});

test('guard persists usage across runs', () => {
  const store = usageStore(join(mkdtempSync(join(tmpdir(), 'usage-')), 'usage.json'));
  const guard = quotaGuard({ store, stopAt, now: () => now });
  assert.equal(guard.check().pause, false);
  guard.record([{ window: 'seven_day', percent: 90.2, resetsAt: '2026-11-30T00:00:00.000Z', status: 'allowed' }]);
  assert.equal(quotaGuard({ store, stopAt, now: () => now }).check().pause, true);
});

test('stream-json output: result, quota events and limit detection', () => {
  const lines = [
    { type: 'system', subtype: 'init' },
    { type: 'rate_limit_event', rate_limit_info: { status: 'allowed', utilization: 0.5, resetsAt: later, rateLimitType: 'five_hour' } },
    { type: 'result', structured_output: { status: 'done', commits: [], docs: [], blocker: null }, total_cost_usd: 0.2 },
  ].map((event) => JSON.stringify(event)).join('\n');
  const parsed = parseAgentOutput(lines);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.usage[0].percent, 50);
  assert.equal(parsed.limited, false);
  const limited = parseAgentOutput(JSON.stringify({ type: 'result', is_error: true, result: 'Claude usage limit reached. Resets at 4pm.' }));
  assert.deepEqual([limited.ok, limited.limited], [false, true]);
  assert.equal(snapshotsFromStream([{ type: 'rate_limit_event', rate_limit_info: 'garbage' }]).length, 0);
});
