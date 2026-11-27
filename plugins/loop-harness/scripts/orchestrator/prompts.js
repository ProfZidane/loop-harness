// Prompts given to each agent. Plain text, English, no emoji. Rules come from CLAUDE.md and .loop/rules.

const ticketText = (issue) => `Ticket #${issue.number}: ${issue.title}\n\n${issue.body ?? ''}`;

const findingsText = (findings) =>
  findings.map((f) => `- [${f.severity}] ${f.file}${f.line ? `:${f.line}` : ''} (${f.rule}): ${f.message}`).join('\n');

export const PROMPTS = {
  planner: ({ issue, run, feedback }) => [
    ticketText(issue),
    `Plan output path: ${run.planPath}`,
    `Mockup output path (UI work only): ${run.mockupPath}`,
    feedback?.length ? `The plan reviewer asked for changes:\n${findingsText(feedback)}` : '',
  ].filter(Boolean).join('\n\n'),

  'plan-reviewer': ({ issue, run }) => [ticketText(issue), `Plan: ${run.planPath}`, `Mockup: ${run.mockupPath}`].join('\n\n'),

  builder: ({ issue, run, branch, findings, adr }) => [
    ticketText(issue),
    `Approved plan: ${run.planPath}`,
    `Worktree: current directory. Branch: ${branch}.`,
    adr ? `Add this ADR under docs/adr/ with the next free number:\n${adr}` : '',
    issue.labels.includes('hotfix') ? 'Hotfix: fix the failed deploy described in the ticket, and write a COE in docs/coe/ with the docs-writer skill.' : '',
    findings?.length ? `Fix mode. Fix every blocker and major finding:\n${findingsText(findings)}` : 'Build mode: implement the plan with TDD.',
  ].filter(Boolean).join('\n\n'),

  reviewer: ({ issue }) => [ticketText(issue), 'Base: origin/main. Head: HEAD (current directory).'].join('\n\n'),
};

export const prTitle = (issue, branch) => {
  const conventional = /^[a-z]+\([a-z0-9-]+\)!?: [a-z0-9].*[^.]$/;
  if (conventional.test(issue.title) && issue.title.length <= 72) return issue.title;
  const type = branch.split('/')[0] === 'hotfix' ? 'fix' : branch.split('/')[0];
  const description = issue.title.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, ' ').trim();
  return `${type}(loop): ${description}`.slice(0, 72).trim();
};

export const prBody = ({ issue, gate, reviews }) => [
  `Closes #${issue.number}`,
  '',
  `Risk: ${gate.risk}`,
  ...gate.reasons.map((reason) => `- ${reason}`),
  '',
  'Reviews:',
  ...reviews.map((r) => `- ${r.agent}: ${r.output.verdict}, ${r.output.findings.length} finding(s)`),
].join('\n');
