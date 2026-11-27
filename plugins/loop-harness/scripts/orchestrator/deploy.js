// Deploy check. Each target has a `check` command from .loop/config.yml:
// exit 0 = latest main deployment healthy, exit 75 = still deploying (poll again), other = failed.

const STILL_DEPLOYING = 75;

const probe = (exec, cwd, target) => {
  try {
    exec('sh', ['-c', target.check], { cwd });
    return { state: 'ok' };
  } catch (error) {
    const output = String(`${error.stdout ?? ''}${error.stderr ?? ''}` || error.message).slice(-2000);
    return { state: error.status === STILL_DEPLOYING ? 'pending' : 'failed', output };
  }
};

const waitTarget = async ({ exec, cwd, target, attempts, sleep }) => {
  const result = probe(exec, cwd, target);
  if (result.state !== 'pending') return result;
  if (attempts <= 1) return { state: 'failed', output: `timed out waiting for ${target.name}` };
  await sleep();
  return waitTarget({ exec, cwd, target, attempts: attempts - 1, sleep });
};

export const checkDeploy = async ({ exec, cwd, targets, attempts, sleep }) => {
  const results = await targets
    .filter((target) => target.check)
    .reduce(async (previous, target) => [
      ...(await previous),
      { name: target.name, ...(await waitTarget({ exec, cwd, target, attempts, sleep })) },
    ], Promise.resolve([]));
  const failures = results.filter((r) => r.state === 'failed');
  return { ok: failures.length === 0, failures, checked: results.length };
};
