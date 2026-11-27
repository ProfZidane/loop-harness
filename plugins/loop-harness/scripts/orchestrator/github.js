// GitHub adapter over the gh CLI. exec(cmd, args, { cwd, input }) -> stdout.

export const LABELS = {
  'loop:ready': '0e8a16',
  'loop:planning': 'fbca04',
  'loop:awaiting-plan': 'd93f0b',
  'loop:plan-approved': '0e8a16',
  'loop:in-progress': '1d76db',
  'loop:awaiting-review': 'd93f0b',
  'loop:done': '5319e7',
  'loop:blocked': 'b60205',
  'loop:question': 'cc317c',
  hotfix: 'b60205',
};

const LOOP_LABELS = Object.keys(LABELS).filter((label) => label.startsWith('loop:'));
const HOTFIX_FIRST = (a, b) => Number(b.labels.includes('hotfix')) - Number(a.labels.includes('hotfix'));

export const github = (exec, cwd) => {
  const gh = (args, input) => exec('gh', args, { cwd, input });
  const issueNumber = (url) => Number(url.trim().split('/').pop());

  return {
    ensureLabels: () =>
      Object.entries(LABELS).forEach(([name, color]) => gh(['label', 'create', name, '--color', color, '--force'])),

    listReady: () =>
      ['loop:ready', 'loop:plan-approved']
        .flatMap((label) => JSON.parse(gh(['issue', 'list', '--label', label, '--state', 'open', '--limit', '50', '--json', 'number,title,body,labels,createdAt'])))
        .map((issue) => ({ ...issue, labels: issue.labels.map((label) => label.name) }))
        .sort((a, b) => HOTFIX_FIRST(a, b) || a.createdAt.localeCompare(b.createdAt)),

    listByLabel: (label) =>
      JSON.parse(gh(['issue', 'list', '--label', label, '--state', 'open', '--limit', '100', '--json', 'number,title']))
        .map((issue) => issue.number),

    setStatus: (number, status) =>
      gh(['issue', 'edit', String(number), ...LOOP_LABELS.flatMap((label) => ['--remove-label', label]), '--add-label', status]),

    comment: (number, body) => gh(['issue', 'comment', String(number), '--body-file', '-'], body),

    createIssue: ({ title, body, labels }) =>
      issueNumber(gh(['issue', 'create', '--title', title, '--body-file', '-', ...labels.flatMap((label) => ['--label', label])], body)),

    closeIssue: (number) => gh(['issue', 'close', String(number), '--reason', 'completed']),

    openPr: ({ branch, title, body, reviewer }) =>
      gh(['pr', 'create', '--head', branch, '--base', 'main', '--title', title, '--body-file', '-',
        ...(reviewer ? ['--reviewer', reviewer] : [])], body).trim(),

    waitChecks: (url) => {
      try {
        gh(['pr', 'checks', url, '--watch', '--fail-fast']);
        return { ok: true };
      } catch (error) {
        return { ok: false, output: String(error.stdout ?? error.message).slice(-2000) };
      }
    },

    mergePr: (url) => {
      gh(['pr', 'merge', url, '--squash', '--delete-branch']);
      return gh(['pr', 'view', url, '--json', 'mergeCommit', '--jq', '.mergeCommit.oid']).trim();
    },
  };
};
