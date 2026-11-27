import { SCHEMAS } from './schemas.js';
import { snapshotsFromStream } from './usage.js';

const PLUGIN = 'loop-harness';
const FENCED_JSON = /```json\s*([\s\S]*?)```/g;

const lastJsonBlock = (text) => {
  const blocks = [...String(text ?? '').matchAll(FENCED_JSON)];
  return blocks.length > 0 ? JSON.parse(blocks[blocks.length - 1][1]) : null;
};

export const agentArgs = ({ agent, prompt, settings }) => [
  '-p',
  '--agent', `${PLUGIN}:${agent}`,
  '--output-format', 'stream-json',
  '--verbose',
  '--json-schema', JSON.stringify(SCHEMAS[agent]),
  '--permission-mode', settings.permissionMode,
  '--permission-prompts', 'none',
  '--max-budget-usd', String(settings.budgetUsd),
  ...(settings.model ? ['--model', settings.model] : []),
  prompt,
];

const LIMIT_TEXT = /usage limit|rate limit|limit reached|out of (extra )?usage/i;

const parseLines = (stdout) =>
  String(stdout).split('\n').map((line) => line.trim()).filter(Boolean).flatMap((line) => {
    try {
      return [JSON.parse(line)];
    } catch {
      return [];
    }
  });

const hitLimit = (events, envelope) =>
  events.some((e) => e.type === 'system' && e.subtype === 'api_retry' && e.error === 'rate_limit')
  || snapshotsFromStream(events).some((s) => s.status === 'rejected')
  || (Boolean(envelope.is_error) && LIMIT_TEXT.test(String(envelope.result ?? '')));

// Accepts stream-json (one event per line, last `result` event wins) or a single json envelope.
export const parseAgentOutput = (stdout) => {
  const events = parseLines(stdout);
  const envelope = events.filter((e) => e.type === 'result').at(-1) ?? events.at(-1) ?? {};
  const usage = snapshotsFromStream(events);
  const limited = hitLimit(events, envelope);
  const output = envelope.structured_output ?? lastJsonBlock(envelope.result);
  const cost = envelope.total_cost_usd ?? 0;
  if (envelope.is_error || !output || limited) {
    return { ok: false, error: envelope.result ?? 'agent returned no structured output', cost, usage, limited };
  }
  return { ok: true, output, cost, usage, limited };
};

// execAsync(cmd, args, { cwd, timeout }) -> Promise<stdout>. Injected so the pipeline can be tested without Claude.
export const runAgent = (execAsync) => async ({ agent, prompt, cwd, settings }) => {
  try {
    return parseAgentOutput(await execAsync('claude', agentArgs({ agent, prompt, settings }), { cwd, timeout: settings.timeoutMs }));
  } catch (error) {
    const partial = error.stdout ? parseAgentOutput(error.stdout) : { usage: [], limited: false };
    return { ok: false, error: String(error.stderr || error.message).slice(-2000), cost: 0, usage: partial.usage, limited: partial.limited };
  }
};
