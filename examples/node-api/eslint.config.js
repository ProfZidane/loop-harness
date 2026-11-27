import { express } from '../../packages/eslint-config/src/index.js';

export default [
  { ignores: ['coverage/**', 'eslint.config.js', 'vitest.config.ts'] },
  ...express,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
