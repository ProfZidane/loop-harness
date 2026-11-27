// Run state on disk, outside the repository: ~/.loop-harness/{runs,worktrees}/<repo>/<issue>/
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const store = ({ home, repoName, now }) => {
  const runDir = (number) => join(home, 'runs', repoName, String(number));
  const ensure = (dir) => {
    mkdirSync(dir, { recursive: true });
    return dir;
  };

  return {
    runFor: (issue) => {
      const dir = ensure(runDir(issue.number));
      return { dir, planPath: join(dir, 'plan.md'), mockupPath: join(dir, 'mockup.html') };
    },
    worktreePath: (ctx) => join(ensure(join(home, 'worktrees', repoName)), String(ctx.issue.number)),
    hasPlan: (ctx) => existsSync(join(runDir(ctx.issue.number), 'plan.json')),
    readPlan: (ctx) => JSON.parse(readFileSync(join(runDir(ctx.issue.number), 'plan.json'), 'utf8')),
    savePlan: (ctx, plan) => writeFileSync(join(ensure(runDir(ctx.issue.number)), 'plan.json'), JSON.stringify(plan, null, 2)),
    log: (ctx, step, data) =>
      appendFileSync(join(ensure(runDir(ctx.issue.number)), 'log.jsonl'), `${JSON.stringify({ at: now().toISOString(), step, ...data })}\n`),
    lock: () => {
      const path = join(ensure(join(home, 'runs', repoName)), 'lock');
      if (existsSync(path)) {
        const pid = Number(readFileSync(path, 'utf8'));
        const alive = (() => { try { process.kill(pid, 0); return true; } catch { return false; } })();
        if (alive) return null;
      }
      writeFileSync(path, String(process.pid));
      return () => rmSync(path, { force: true });
    },
  };
};
