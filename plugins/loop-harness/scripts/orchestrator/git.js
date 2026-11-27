import { existsSync } from 'node:fs';

// Git adapter: one worktree and one branch per ticket. exec(cmd, args, { cwd }) -> stdout.

const slug = (title) =>
  title.toLowerCase().replace(/^[a-z]+(\([^)]*\))?!?:\s*/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

const TYPES = ['feat', 'fix', 'docs', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'hotfix'];

export const branchFor = (issue) => {
  const type = TYPES.find((t) => issue.title.toLowerCase().startsWith(t)) ?? (issue.labels?.includes('hotfix') ? 'hotfix' : 'feat');
  return `${type}/${issue.number}-${slug(issue.title) || 'ticket'}`;
};

export const git = (exec, repoDir) => {
  const run = (args, cwd = repoDir) => exec('git', args, { cwd });

  return {
    createWorktree: ({ path, branch }) => {
      if (existsSync(path)) return path;
      run(['fetch', 'origin', 'main']);
      run(['worktree', 'add', '-B', branch, path, 'origin/main']);
      return path;
    },
    removeWorktree: (path) => run(['worktree', 'remove', '--force', path]),
    changedFiles: (path) => run(['diff', '--name-only', 'origin/main...HEAD'], path).split('\n').filter(Boolean),
    commits: (path) => run(['log', '--format=%H', 'origin/main..HEAD'], path).split('\n').filter(Boolean),
    push: (path, branch) => run(['push', '-u', 'origin', branch], path),
    revertCommit: ({ path, sha, branch }) => {
      run(['fetch', 'origin', 'main']);
      run(['worktree', 'add', '-B', branch, path, 'origin/main']);
      run(['revert', '--no-edit', sha], path);
      run(['commit', '--amend', '-m', `revert(loop): revert ${sha.slice(0, 7)} after failed deploy`], path);
      return path;
    },
  };
};
