# Core rules (stack-agnostic)

Tags: **[LINT]** enforced by linter/compiler · **[CI]** enforced by a test or CI job · **[REVIEW]** checked by a reviewer agent · **[PR]** forces a pull request + human notification

## 0. Decision method (trade-offs)

1. **Need first**: the solution covers exactly the need stated in the ticket, nothing more. [REVIEW]
2. Meet the need **without ever compromising security**. [REVIEW]
3. Then **performance**.
4. Then **maintainability**.
5. **Always assess risk**: every plan has a `Risks` section (threat, impact, likelihood, mitigation). Sensitive features (auth, personal data, payment, third-party services) get an EBIOS RM-style analysis: risk sources, scenarios, measures. [REVIEW]

## 1. Principles

- **SRP everywhere**: every folder names exactly what it contains; one file = one responsibility; one function = one thing. [REVIEW]
- **Strict functional programming**: no `class`, no `this`, except where the framework requires it (Angular components/services, Mongoose models). [LINT `no-restricted-syntax` ClassDeclaration outside allowed paths]
- **Errors are data**: `neverthrow` (`Result` / `ResultAsync`) for all business logic; `throw` only for bugs and infrastructure failures. [REVIEW]
- **Immutability**: `const`, `readonly`, spread; no mutation. [LINT `prefer-const`, `functional/immutable-data`]
- **Function ≤ 30 lines.** [LINT `max-lines-per-function`]
- **Dependencies through direct ES imports**; mock with `vi.mock` in tests.

## 2. Code style

- **Dictionary over branching**: 3 or more branches on the same value → typed, exhaustive dictionary (`Record<Union, Fn | Value>`); `switch` / `if-else` tolerated up to 2 branches. [LINT `no-restricted-syntax` on `SwitchStatement[cases.length>2]` + REVIEW for if/else chains]

  ```ts
  const computeByType: Record<ExpenseType, (e: Expense) => Decimal> = {
    rent: computeRent,
    taxes: computeTaxes,
    electricityBill: computeBill,
  };
  export const compute = (e: Expense): Decimal => computeByType[e.type](e);
  ```

- **No magic numbers**: every business literal comes from a named constant. [LINT `no-magic-numbers` with ignore [0, 1, -1]]
- **Self-explanatory code**: names of variables and functions carry the meaning. A comment exists only to explain a specific case (non-obvious constraint, external quirk, trap). No paraphrasing comments, no commented-out code; `TODO` only with an issue number `TODO(#42)`. [REVIEW + LINT `no-warning-comments` without issue ref]
- **No emoji anywhere**: code, comments, logs, commits, PRs, issues, docs, notifications. [CI emoji check on diff + commitlint]
- Standard good practices apply by default (early return, no dead code, small pure functions). [REVIEW]

## 3. Naming & TypeScript

- All code in English (identifiers, fields, routes, commits, docs). [REVIEW]
- UI language is a project setting (`.loop/config.yml` → `ui.language`); multilingual → i18n mandatory, no hardcoded UI text. [REVIEW]
- camelCase everywhere (database, API, TypeScript): zero mapping. [LINT `naming-convention`]
- Files `kebab-case.<type>.ts` (`expense.service.ts`); constants `SCREAMING_SNAKE`; types `PascalCase`. [LINT]
- Zero `any`: use `unknown` + narrowing. [LINT `no-explicit-any`: error]
- Explicit return type on every exported function. [LINT `explicit-module-boundary-types`]
- `tsc --noEmit` strict, zero error. [CI]

## 4. Tests

- Test what matters and the critical path, never for the numbers. A worthless test (getter, trivial mapping, useless snapshot) is rejected. [REVIEW]
- **TDD**: acceptance criteria → failing test → code → green; test and code in the same commit; every acceptance criterion has at least one test. [REVIEW]
- Coverage ≥ 80 % of the diff on business logic folders (`services/`), blocking; elsewhere the reviewer judges relevance. [CI]
- Gates: ESLint + Prettier, `tsc --noEmit`, knip (dead code), commitlint. [CI + pre-commit]

## 5. Git

- Commit: **one line**, English, no emoji, **no `Co-Authored-By`**, format `type(scope): description` (`feat(expense): add pagination to list`). [CI commitlint + attribution disabled in Claude Code settings]
- Branch: `type/kebab-description` (`feat/expenses-pagination`). [CI]

## 6. Security (OWASP-driven)

- Baseline: OWASP Top 10 and OWASP ASVS level 1 for every feature; level 2 for auth, payment and personal data. [REVIEW security]
- Validate every input at the boundary and use only the parsed output, never raw request data. [REVIEW]
- Access control on every route that needs it; resource ownership comes from the authenticated identity, never from the request body. [REVIEW security]
- Security headers, explicit CORS allowlist (never `*`), rate limiting on auth endpoints. [REVIEW + test]
- No secret in code or logs. Scans: gitleaks, Semgrep, `npm audit`. [CI]

## 7. Dependencies

Before adding a package, the plan states:
1. **Cost of writing it ourselves**: a few simple functions → write them.
2. **Known CVEs** (`npm audit` / OSV): unpatched high or critical CVE → do not install. [CI blocking]
Otherwise the dependency can be added without a mandatory PR.

## 8. Always goes through the human [PR]

- Auth and security code: auth middlewares, tokens, cookies, CORS, rate limiting, access control
- Data model changes: schemas and indexes
- Config, env and CI: `.env*`, `config/`, `.github/workflows/`, `.loop/`, `.claude/`
- Breaking API change: removed or renamed route, removed response field

The loop may raise a ticket to sensitive, never lower it. Detection is done by the orchestrator from file paths and diff analysis, not by an agent.
