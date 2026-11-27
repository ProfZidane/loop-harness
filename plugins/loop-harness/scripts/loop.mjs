#!/usr/bin/env node
// loop-harness orchestrator. Usage: node loop.mjs <run|daemon|status|doctor|usage> [projectDir]
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readSettings, inWindow } from './orchestrator/settings.js';
import { runAgent } from './orchestrator/agent.js';
import { github } from './orchestrator/github.js';
import { git } from './orchestrator/git.js';
import { store } from './orchestrator/store.js';
import { ntfy, email, ROUTES } from './orchestrator/notify.js';
import { checkDeploy } from './orchestrator/deploy.js';
import { revert } from './orchestrator/revert.js';
import { runOnce } from './orchestrator/queue.js';
import { quotaGuard, usageStore, snapshotsFromStream } from './orchestrator/usage.js';
import { missingPacks, readDeclaredStack } from './init/packs.js';

const MAX_BUFFER = 64 * 1024 * 1024;
const PLUGIN_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const execFileAsync = promisify(execFile);

const exec = (cmd, args, { cwd, input, timeout } = {}) =>
  execFileSync(cmd, args, { cwd, input, timeout, encoding: 'utf8', maxBuffer: MAX_BUFFER, stdio: ['pipe', 'pipe', 'pipe'] });

const execAsync = async (cmd, args, { cwd, timeout } = {}) =>
  (await execFileAsync(cmd, args, { cwd, timeout, encoding: 'utf8', maxBuffer: MAX_BUFFER })).stdout;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const notifier = (settings) => async (event, { title, message, url }) => {
  const route = ROUTES[event] ?? { push: 'normal', email: false };
  const push = route.push ? await ntfy(fetch)({ ...settings.notify.ntfy, title, message, priority: route.push, url }).catch((e) => ({ sent: false, reason: e.message })) : null;
  const mail = route.email ? email(exec, process.env)({ ...settings.notify.email, subject: `[loop] ${title}`, text: `${message}\n${url ?? ''}` }) : null;
  return { push, mail };
};

export const wire = (repoDir) => {
  const settings = readSettings(readFileSync(join(repoDir, '.loop', 'config.yml'), 'utf8'));
  const home = join(homedir(), '.loop-harness');
  const runStore = store({ home, repoName: basename(repoDir), now: () => new Date() });
  const quota = quotaGuard({ store: usageStore(join(home, 'usage.json')), stopAt: settings.quota, now: () => new Date() });
  const deps = {
    repoDir, settings, store: runStore, log: runStore.log, quota,
    runAgent: runAgent(execAsync), gh: github(exec, repoDir), git: git(exec, repoDir), notify: notifier(settings),
    checkDeploy: () => checkDeploy({ exec, cwd: repoDir, targets: settings.deploy.checks, attempts: settings.deploy.attempts, sleep: () => sleep(settings.deploy.pollMs) }),
  };
  return { ...deps, revert: revert(deps) };
};

const probeCommand = (cmd, args, cwd) => {
  try {
    exec(cmd, args, { cwd });
    return true;
  } catch {
    return false;
  }
};

export const doctor = (repoDir) => {
  const packs = missingPacks(PLUGIN_ROOT, readDeclaredStack(repoDir));
  const checks = {
    'claude CLI available': probeCommand('claude', ['--version'], repoDir),
    'gh CLI logged in': probeCommand('gh', ['auth', 'status'], repoDir),
    'git remote origin': probeCommand('git', ['remote', 'get-url', 'origin'], repoDir),
    'rule packs present': packs.length === 0,
  };
  return { ok: Object.values(checks).every(Boolean), checks, missingPacks: packs };
};

const once = async (deps) => {
  const health = doctor(deps.repoDir);
  if (!health.ok) return { skipped: 'doctor failed', ...health };
  const unlock = deps.store.lock();
  if (!unlock) return { skipped: 'another loop is running on this repository' };
  try {
    deps.gh.ensureLabels();
    return await runOnce(deps);
  } finally {
    unlock();
  }
};

const MINUTE_MS = 60000;

// Waits for the next poll, or until the quota window resets when the loop is paused.
const nextDelay = (deps) => {
  const poll = deps.settings.pollMinutes * MINUTE_MS;
  const quota = deps.quota.check();
  if (!quota.pause || !quota.until) return poll;
  return Math.max(poll, new Date(quota.until).getTime() - Date.now() + MINUTE_MS);
};

const daemon = async (deps) => {
  const tick = async () => {
    const result = inWindow(deps.settings.window, new Date()) ? await once(deps) : { skipped: 'outside time window' };
    console.log(JSON.stringify({ at: new Date().toISOString(), ...result }));
    await sleep(nextDelay(deps));
    return tick();
  };
  return tick();
};

// Shows the last known quota. With --probe, runs one tiny headless call to refresh it and prints the raw events.
const usage = async (deps, argv) => {
  if (!argv.includes('--probe')) return { stopAt: deps.settings.quota, ...deps.quota.check(), usage: deps.quota.record([]) };
  const stdout = await execAsync('claude', ['-p', '--output-format', 'stream-json', '--verbose', '--max-turns', '1', 'Reply with: ok'], { cwd: deps.repoDir });
  const events = stdout.split('\n').filter(Boolean).map((line) => JSON.parse(line)).filter((e) => e.type === 'rate_limit_event');
  return { rawEvents: events, decision: deps.quota.record(snapshotsFromStream(events)) };
};

const status = (deps) => Object.fromEntries(
  ['loop:ready', 'loop:planning', 'loop:awaiting-plan', 'loop:plan-approved', 'loop:in-progress', 'loop:awaiting-review', 'loop:question', 'loop:blocked']
    .map((label) => [label, deps.gh.listByLabel(label)]),
);

const COMMANDS = { run: once, daemon, usage, status: async (deps) => status(deps), doctor: async (deps) => doctor(deps.repoDir) };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, dir = '.', ...rest] = process.argv.slice(2);
  if (!COMMANDS[command]) {
    console.error('Usage: loop.mjs <run|daemon|status|doctor|usage> [projectDir] [--probe]');
    process.exit(2);
  }
  const result = await COMMANDS[command](wire(resolve(dir)), rest);
  console.log(JSON.stringify(result, null, 2));
}
