const FLAGS_WITH_VALUE = new Set(['--range', '--commit-msg', '--text', '--name']);

export const parseArgs = (argv) =>
  argv.reduce(
    (state, token) => {
      if (state.pending) return { ...state, pending: null, [state.pending]: token };
      if (FLAGS_WITH_VALUE.has(token)) return { ...state, pending: token.slice(2) };
      return token.startsWith('--') ? { ...state, [token.slice(2)]: true } : state;
    },
    { pending: null },
  );

export const report = (title, failures) => {
  if (failures.length === 0) return 0;
  console.error(`${title}: ${String(failures.length)} problem(s)`);
  failures.forEach((failure) => console.error(`  ${failure}`));
  return 1;
};
