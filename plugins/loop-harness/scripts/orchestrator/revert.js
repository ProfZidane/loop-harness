// When a hotfix ticket fails, revert the merge that broke the deploy, unless it was sensitive.

const field = (body, name) => new RegExp(`^${name}: (.+)$`, 'm').exec(body ?? '')?.[1]?.trim();

export const revertPlan = (issue) => {
  const sha = field(issue.body, 'Merge');
  return {
    sha: /^[0-9a-f]{7,40}$/.test(sha ?? '') ? sha : null,
    sensitive: field(issue.body, 'Sensitive') === 'yes',
  };
};

export const revert = (deps) => async (ctx) => {
  const { sha, sensitive } = revertPlan(ctx.issue);
  if (!sha) return { reverted: false, reason: 'no merge commit recorded' };
  if (sensitive) {
    await deps.notify('deploy-failed', { title: 'Hotfix failed: your decision', message: `Merge ${sha} touched a sensitive zone. No automatic revert.` });
    return { reverted: false, reason: 'sensitive merge' };
  }
  const branch = `revert/${ctx.issue.number}-failed-deploy`;
  const path = deps.store.worktreePath({ issue: { number: `${ctx.issue.number}-revert` } });
  deps.git.revertCommit({ path, sha, branch });
  deps.git.push(path, branch);
  const url = deps.gh.openPr({ branch, title: `revert(loop): revert ${sha.slice(0, 7)} after failed deploy`, body: `Hotfix #${ctx.issue.number} failed. Reverting ${sha}.` });
  const checks = deps.gh.waitChecks(url);
  if (checks.ok) deps.gh.mergePr(url);
  deps.git.removeWorktree(path);
  await deps.notify('deploy-failed', { title: checks.ok ? 'Reverted failed deploy' : 'Revert blocked by CI', message: url, url });
  return { reverted: checks.ok, url };
};
