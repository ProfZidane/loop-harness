// Reads .loop/config.yml into the settings object used by the pipeline.
import { getMap, getValue } from '../init/yaml-lite.js';

const MINUTE_MS = 60000;
const SECOND_MS = 1000;

const num = (text, path, fallback) => {
  const value = Number(getValue(text, path));
  return Number.isFinite(value) && getValue(text, path) !== '' && getValue(text, path) !== undefined ? value : fallback;
};

const listOf = (text, path) => {
  const value = getValue(text, path);
  return Array.isArray(value) ? value : [];
};

const DEFAULTS = { maxParallel: 3, maxReviewIterations: 3, budgetUsdPerAgent: 5, budgetUsdPerTicket: 15, agentTimeoutMinutes: 45 };

export const readSettings = (text) => ({
  maxParallel: num(text, 'loop.maxParallel', DEFAULTS.maxParallel),
  maxReviewIterations: num(text, 'loop.maxReviewIterations', DEFAULTS.maxReviewIterations),
  budgetUsdPerTicket: num(text, 'loop.budgetUsdPerTicket', DEFAULTS.budgetUsdPerTicket),
  agent: {
    permissionMode: getValue(text, 'loop.permissionMode') || 'auto',
    budgetUsd: num(text, 'loop.budgetUsdPerAgent', DEFAULTS.budgetUsdPerAgent),
    model: getValue(text, 'loop.model') || null,
    timeoutMs: num(text, 'loop.agentTimeoutMinutes', DEFAULTS.agentTimeoutMinutes) * MINUTE_MS,
  },
  risk: {
    sensitivePaths: listOf(text, 'sensitive.paths'),
    coreBusinessPaths: listOf(text, 'coreBusiness.paths'),
    coreBusinessLabels: listOf(text, 'coreBusiness.labels'),
    autoMerge: getValue(text, 'loop.autoMerge') === 'true',
  },
  reviewer: getValue(text, 'notify.githubReviewer') || null,
  hotfixTimeoutMinutes: num(text, 'deploy.hotfix.timeoutMinutes', 30),
  deploy: {
    checks: Object.entries(getMap(text, 'deploy.checks')).filter(([, check]) => check).map(([name, check]) => ({ name, check })),
    attempts: Math.max(1, Math.round((num(text, 'deploy.waitMinutes', 15) * MINUTE_MS) / (num(text, 'deploy.pollSeconds', 30) * SECOND_MS))),
    pollMs: num(text, 'deploy.pollSeconds', 30) * SECOND_MS,
  },
  notify: {
    ntfy: { server: getValue(text, 'notify.ntfy.server') || undefined, topic: getValue(text, 'notify.ntfy.topic') || null },
    email: {
      smtpUrl: getValue(text, 'notify.email.smtpUrl') || 'smtps://smtp.gmail.com:465',
      to: getValue(text, 'notify.email.to') || null,
      userEnv: getValue(text, 'notify.email.smtpUserEnv') || 'LOOP_SMTP_USER',
      passwordEnv: getValue(text, 'notify.email.smtpPasswordEnv') || 'LOOP_SMTP_APP_PASSWORD',
    },
  },
  quota: {
    five_hour: num(text, 'loop.quota.fiveHourStopAt', 90),
    seven_day: num(text, 'loop.quota.weeklyStopAt', 90),
  },
  pollMinutes: num(text, 'tickets.pollMinutes', 5),
  window: getValue(text, 'loop.modes.window') || null,
});

// "22:00-07:00" -> is `date` inside the window? Windows may cross midnight.
export const inWindow = (window, date) => {
  if (!window) return true;
  const [start, end] = window.split('-').map((part) => part.split(':').map(Number)).map(([h, m]) => h * 60 + m);
  const minutes = date.getHours() * 60 + date.getMinutes();
  return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
};
