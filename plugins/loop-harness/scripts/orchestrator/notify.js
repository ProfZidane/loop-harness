// Notification adapters: ntfy push for urgent events, SMTP email recap through curl. No dependency.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_NTFY = 'https://ntfy.sh';
const PRIORITY = { urgent: 'urgent', high: 'high', normal: 'default' };

export const ntfy = (fetchFn) => async ({ server = DEFAULT_NTFY, topic, title, message, priority = 'normal', url }) => {
  if (!topic) return { sent: false, reason: 'no ntfy topic configured' };
  const headers = { Title: title, Priority: PRIORITY[priority] ?? 'default', ...(url ? { Click: url } : {}) };
  const response = await fetchFn(`${server}/${encodeURIComponent(topic)}`, { method: 'POST', headers, body: message });
  return { sent: response.ok, status: response.status };
};

export const mimeMessage = ({ from, to, subject, text }) =>
  [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`, 'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', '', text, ''].join('\r\n');

// Credentials go through a temporary netrc file (mode 600), never through the command line.
export const email = (exec, env) => ({ smtpUrl, userEnv, passwordEnv, to, subject, text }) => {
  const [user, password] = [env[userEnv], env[passwordEnv]];
  if (!user || !password || !to) return { sent: false, reason: 'email not configured' };
  const dir = mkdtempSync(join(tmpdir(), 'loop-mail-'));
  const netrc = join(dir, 'netrc');
  const host = new URL(smtpUrl).hostname;
  writeFileSync(netrc, `machine ${host} login ${user} password ${password}\n`, { mode: 0o600 });
  try {
    exec('curl', ['--silent', '--show-error', '--ssl-reqd', '--url', smtpUrl, '--netrc-file', netrc,
      '--mail-from', user, '--mail-rcpt', to, '--upload-file', '-'], { input: mimeMessage({ from: user, to, subject, text }) });
    return { sent: true };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

// Which channel gets which event.
export const ROUTES = {
  'deploy-failed': { push: 'urgent', email: true },
  'deploy-restored': { push: 'high', email: true },
  blocked: { push: 'high', email: true },
  question: { push: 'high', email: false },
  'plan-awaiting': { push: 'high', email: true },
  'review-requested': { push: 'normal', email: true },
  merged: { push: null, email: true },
};
