import { express } from '../../plugins/loop-harness/presets/eslint/src/index.js';

export default [
  { ignores: ['coverage/**', 'eslint.config.js', 'vitest.config.ts'] },
  ...express,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
