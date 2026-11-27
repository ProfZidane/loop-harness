import angularEslint from 'angular-eslint';
import rxjsX from 'eslint-plugin-rxjs-x';
import { typescript, noBigSwitchSelector } from './typescript.js';

const CLASS_BASED_GUARDS = 'CanActivate|CanActivateChild|CanDeactivate|CanMatch|Resolve|HttpInterceptor';

export const angular = [
  ...typescript,
  ...angularEslint.configs.tsRecommended.map((config) => ({ ...config, files: ['**/*.ts'] })),
  {
    files: ['**/*.ts'],
    processor: angularEslint.processInlineTemplates,
    plugins: { 'rxjs-x': rxjsX },
    rules: {
      'no-restricted-syntax': ['error',
        noBigSwitchSelector,
        { selector: 'ClassDeclaration:not([decorators.length>0]), ClassExpression',
          message: 'Only Angular-decorated classes are allowed; use functions elsewhere.' },
        { selector: `TSClassImplements[expression.name=/^(${CLASS_BASED_GUARDS})$/]`,
          message: 'Use functional guards, resolvers and interceptors (CanActivateFn, HttpInterceptorFn).' },
      ],
      '@angular-eslint/prefer-inject': 'error',
      'rxjs-x/no-ignored-subscription': 'error',
      'functional/immutable-data': ['error', { ignoreClasses: true }],
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },
  {
    files: ['**/*.ts'],
    ignores: ['src/app/services/api/**', '**/*.spec.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: '@angular/common/http', importNames: ['HttpClient'],
          message: 'HttpClient is used only in services/api/*.api.ts.' }],
      }],
    },
  },
  ...angularEslint.configs.templateRecommended.map((config) => ({ ...config, files: ['**/*.html'] })),
];
