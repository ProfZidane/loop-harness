// JSON schemas passed to `claude -p --json-schema`, mirroring rules/loop.md "Agent outputs".

const str = { type: 'string' };
const bool = { type: 'boolean' };
const strings = { type: 'array', items: str };
const nullableStr = { type: ['string', 'null'] };

const finding = {
  type: 'object',
  required: ['severity', 'file', 'rule', 'message'],
  properties: {
    severity: { enum: ['blocker', 'major', 'minor'] },
    file: str,
    line: { type: ['integer', 'null'] },
    rule: str,
    message: str,
  },
};

const findings = { type: 'array', items: finding };

const object = (properties) => ({ type: 'object', required: Object.keys(properties), properties });

const reviewer = object({ verdict: { enum: ['approve', 'changes'] }, findings });

export const SCHEMAS = {
  planner: object({
    plan: str,
    files: strings,
    mockup: nullableStr,
    triggers: object({ sensitive: bool, coreBusiness: bool, thirdParty: bool, tradeOff: bool }),
    questions: strings,
  }),
  'plan-reviewer': object({ verdict: { enum: ['approve', 'changes', 'escalate'] }, findings, adr: nullableStr }),
  builder: object({ status: { enum: ['done', 'blocked'] }, commits: strings, docs: strings, blocker: nullableStr }),
  'code-reviewer': reviewer,
  'spec-reviewer': reviewer,
  'security-reviewer': reviewer,
};

export const blocking = (result) => (result.findings ?? []).filter((f) => f.severity === 'blocker' || f.severity === 'major');
