# @loop-harness/eslint-config

ESLint flat configs that enforce every `[LINT]` rule of `plugins/loop-harness/rules/`.

## Presets

| Preset | Use for | Adds |
|---|---|---|
| `typescript` | any TypeScript project | strict typed rules, no classes, immutability, max 30 lines per function, no switch over 2 cases, no magic numbers, naming, kebab-case files, no emoji, TODO with issue |
| `express` | Express API | `typescript` + layer import boundaries, mongoose only in repositories and models |
| `angular` | Angular app | `typescript` + Angular recommended, only decorated classes, `inject()` only, functional guards, `HttpClient` only in `services/api`, no ignored subscriptions |

## Usage

```js
// eslint.config.js
import { express } from '@loop-harness/eslint-config';

export default [
  ...express,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
];
```

Run ESLint from the project root: layer boundaries are resolved from `./src`.

## Tests

`npm test` lints one passing and one failing sample per rule.
