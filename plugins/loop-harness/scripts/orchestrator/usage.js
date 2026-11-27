// Subscription quota guard (Claude Pro/Max, no API). Claude Code emits `rate_limit_event` messages in
// stream-json output, with `rate_limit_info` { status, utilization, resetsAt, rateLimitType }. The format
// is not documented, so parsing is tolerant: unknown shapes are ignored, never trusted as "safe".
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const WINDOW_NAMES = { five_hour: 'five_hour', seven_day: 'seven_day', session: 'five_hour', weekly: 'seven_day' };
const SECONDS_THRESHOLD = 1e12;

const toPercent = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number <= 1 ? number * 100 : number;
};

const toDate = (value) => {
  if (value === undefined || value === null) return null;
  const number = Number(value);
  if (Number.isFinite(number)) return new Date(number < SECONDS_THRESHOLD ? number * 1000 : number);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// One rate_limit_info -> { window, percent, resetsAt, status } or null.
export const snapshotFrom = (info) => {
  if (!info || typeof info !== 'object') return null;
  const window = WINDOW_NAMES[info.rateLimitType ?? info.rate_limit_type ?? 'five_hour'];
  if (!window) return null;
  const percent = info.status === 'rejected' ? 100 : toPercent(info.utilization ?? info.used_percentage);
  return { window, percent, resetsAt: toDate(info.resetsAt ?? info.resets_at)?.toISOString() ?? null, status: info.status ?? null };
};

export const snapshotsFromStream = (lines) =>
  lines
    .filter((event) => event.type === 'rate_limit_event')
    .map((event) => snapshotFrom(event.rate_limit_info))
    .filter(Boolean);

// The last snapshot of each window wins; windows past their reset time are dropped.
export const mergeUsage = (usage, snapshots, now) => {
  const windows = snapshots.reduce((acc, s) => ({ ...acc, [s.window]: s }), usage.windows ?? {});
  const live = Object.fromEntries(Object.entries(windows).filter(([, s]) => !s.resetsAt || new Date(s.resetsAt) > now));
  return { windows: live, updatedAt: now.toISOString() };
};

const overLimit = (snapshot, stopAt) =>
  snapshot.status === 'rejected'
  || (snapshot.percent !== null && snapshot.percent >= stopAt)
  || (snapshot.percent === null && snapshot.status === 'allowed_warning');

export const decide = (usage, stopAt, now) => {
  const live = mergeUsage(usage, [], now).windows;
  const hit = Object.values(live).filter((snapshot) => overLimit(snapshot, stopAt[snapshot.window] ?? stopAt.five_hour));
  if (hit.length === 0) return { pause: false };
  const until = hit.map((s) => s.resetsAt).filter(Boolean).sort().at(-1) ?? null;
  const reason = hit.map((s) => `${s.window} at ${s.percent === null ? s.status : `${Math.round(s.percent)}%`}`).join(', ');
  return { pause: true, until, reason };
};

export const usageStore = (path) => ({
  read: () => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { windows: {} }),
  write: (usage) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(usage, null, 2));
  },
});

// Guard used by the pipeline: check before an agent run, record after it.
export const quotaGuard = ({ store, stopAt, now }) => ({
  check: () => decide(store.read(), stopAt, now()),
  record: (snapshots) => {
    const merged = mergeUsage(store.read(), snapshots, now());
    store.write(merged);
    return decide(merged, stopAt, now());
  },
});
