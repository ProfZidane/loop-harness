# ESLint presets

ESLint flat configs that enforce every `[LINT]` rule of `rules/`. Never published: loop-init copies `src/` into the project at `.loop/eslint/src/` and installs the plugins it needs as dev dependencies.

## Presets

| Preset | Use for | Adds |
|---|---|---|
| `typescript` | any TypeScript project | strict typed rules, no classes, immutability, max 30 lines per function, no switch over 2 cases, no magic numbers, naming, kebab-case files, no emoji, TODO with issue |
| `express` | Express API | `typescript` + layer import boundaries, mongoose only in repositories and models |
| `angular` | Angular or Ionic app | `typescript` + Angular recommended, only decorated classes, `inject()` only, functional guards, `HttpClient` only in `services/api`, no ignored subscriptions |

## In a project

```js
// eslint.config.js, written by loop-init
import { express } from './.loop/eslint/src/express.js';

export default [
  ...express,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
```

## Tests

`npm test` lints one passing and one failing sample per rule.
