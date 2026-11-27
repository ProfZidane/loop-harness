import tseslint from 'typescript-eslint';
import functional from 'eslint-plugin-functional';
import unicorn from 'eslint-plugin-unicorn';
import { loopPlugin } from './plugin.js';

const MAX_FUNCTION_LINES = 30;
const MAX_SWITCH_CASES = 2;

export const noClassSelector = {
  selector: 'ClassDeclaration, ClassExpression',
  message: 'No classes: use functions and plain objects (rules/core.md, section 2).',
};

export const noBigSwitchSelector = {
  selector: `SwitchStatement[cases.length>${MAX_SWITCH_CASES}]`,
  message: 'More than 2 branches: use a typed dictionary (rules/core.md, section 2).',
};

export const typescript = [
  ...tseslint.configs.strictTypeChecked.map((config) => ({ ...config, files: ['**/*.ts'] })),
  {
    files: ['**/*.ts'],
    languageOptions: { parserOptions: { projectService: true } },
    plugins: { functional, unicorn, loop: loopPlugin },
    rules: {
      'loop/no-emoji': 'error',
      'loop/todo-requires-issue': 'error',
      'no-restricted-syntax': ['error', noClassSelector, noBigSwitchSelector],
      'prefer-const': 'error',
      'functional/no-let': ['error', { allowInForLoopInit: true }],
      'functional/immutable-data': ['error', { ignoreClasses: 'fieldsOnly' }],
      'max-lines-per-function': ['error', { max: MAX_FUNCTION_LINES, skipBlankLines: true, skipComments: true }],
      '@typescript-eslint/no-magic-numbers': ['error', {
        ignore: [0, 1, -1],
        ignoreEnums: true,
        ignoreNumericLiteralTypes: true,
        ignoreReadonlyClassProperties: true,
        ignoreTypeIndexes: true,
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
      }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/naming-convention': ['error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'variable', modifiers: ['const'], format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
        { selector: 'objectLiteralProperty', modifiers: ['requiresQuotes'], format: null },
        { selector: 'import', format: null },
      ],
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'max-lines-per-function': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
];
