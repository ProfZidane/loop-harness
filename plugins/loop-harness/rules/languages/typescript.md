# Language pack: TypeScript

Applies to every TypeScript stack (Express, Angular, Ionic, others). Lint preset: `@loop-harness/eslint-config`.

## Mapping of core principles

| Core principle | TypeScript rule | Enforcement |
|---|---|---|
| Functional first | no `class`, no `this` outside framework classes (Angular decorated classes, Mongoose models) | [LINT] |
| Errors are values | `neverthrow` (`Result`, `ResultAsync`) for business logic | [REVIEW] |
| Immutability | `const`, `readonly`, spread; no `let`, no mutation | [LINT] |
| Function at most 30 lines | `max-lines-per-function` | [LINT] |
| Dictionary over branching | `Record<Union, Value or Fn>`, exhaustive by type; no `switch` over 2 cases | [LINT + REVIEW] |
| No magic numbers | `@typescript-eslint/no-magic-numbers`, ignore 0, 1, -1 | [LINT] |
| No emoji | `loop/no-emoji`, literal and escaped | [LINT] |
| TODO with issue | `loop/todo-requires-issue` | [LINT] |

## Dictionary example

```ts
const computeByType: Record<ExpenseType, (e: Expense) => Decimal> = {
  rent: computeRent,
  taxes: computeTaxes,
  electricityBill: computeBill,
};
export const compute = (e: Expense): Decimal => computeByType[e.type](e);
```

## Naming and types

- camelCase everywhere (database, API, code): zero mapping. [LINT]
- Files `kebab-case.<type>.ts` (`expense.service.ts`); constants `SCREAMING_SNAKE`; types `PascalCase`. [LINT]
- No `any`: `unknown` + narrowing. [LINT]
- Explicit return type on every exported function. [LINT]
- `tsc --noEmit` strict, zero error. [CI]

## Modules and tests

- Dependencies through direct ES imports; mock with `vi.mock`.
- Test runner: Vitest. Dead code: knip. Format: Prettier.
