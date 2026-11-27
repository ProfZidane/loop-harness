import { SCHEMAS } from './schemas.js';

const PLUGIN = 'loop-harness';
const FENCED_JSON = /```json\s*([\s\S]*?)```/g;

const lastJsonBlock = (text) => {
  const blocks = [...String(text ?? '').matchAll(FENCED_JSON)];
  return blocks.length > 0 ? JSON.parse(blocks[blocks.length - 1][1]) : null;
};

export const agentArgs = ({ agent, prompt, settings }) => [
  '-p',
  '--agent', `${PLUGIN}:${agent}`,
  '--output-format', 'json',
  '--json-schema', JSON.stringify(SCHEMAS[agent]),
  '--permission-mode', settings.permissionMode,
  '--permission-prompts', 'none',
  '--max-budget-usd', String(settings.budgetUsd),
  ...(settings.model ? ['--model', settings.model] : []),
  prompt,
];

export const parseAgentOutput = (stdout) => {
  const envelope = JSON.parse(stdout);
  const output = envelope.structured_output ?? lastJsonBlock(envelope.result);
  if (envelope.is_error || !output) {
    return { ok: false, error: envelope.result ?? 'agent returned no structured output', cost: envelope.total_cost_usd ?? 0 };
  }
  return { ok: true, output, cost: envelope.total_cost_usd ?? 0 };
};

// execAsync(cmd, args, { cwd, timeout }) -> Promise<stdout>. Injected so the pipeline can be tested without Claude.
export const runAgent = (execAsync) => async ({ agent, prompt, cwd, settings }) => {
  try {
    return parseAgentOutput(await execAsync('claude', agentArgs({ agent, prompt, settings }), { cwd, timeout: settings.timeoutMs }));
  } catch (error) {
    return { ok: false, error: String(error.stderr || error.message).slice(-2000), cost: 0 };
  }
};
