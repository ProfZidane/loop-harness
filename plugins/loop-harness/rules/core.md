# Core rules (language and stack agnostic)

Tags: **[LINT]** enforced by linter/compiler, **[CI]** enforced by a test or CI job, **[REVIEW]** checked by a reviewer agent, **[PR]** forces a pull request + human notification

## 0. Decision method (trade-offs)

1. **Need first**: the solution covers exactly the need stated in the ticket, nothing more. [REVIEW]
2. Meet the need **without ever compromising security**. [REVIEW]
3. Then **performance**.
4. Then **maintainability**.
5. **Always assess risk**: every plan has a `Risks` section (threat, impact, likelihood, mitigation). Sensitive features (auth, personal data, payment, third-party services) get an EBIOS RM-style analysis: risk sources, scenarios, measures. [REVIEW]

## 1. Stack selection

No stack is imposed. The stack is chosen per project at kickoff and recorded in an ADR, using the decision method above. Defaults to challenge, not to apply blindly:

| Need | Default candidates |
|---|---|
| AI, ML, data, RAG | Python; FastAPI for the API |
| Performance | optimize the chosen stack first (profiling, async, vectorization, caching); only stacks the owner masters are candidates |
| Web front | Angular; Vue.js when lightness is needed or the dev team does not know Angular |
| Mobile | ADR comparing Ionic (Angular) and Flutter, backed by a prototype of each run on emulators; the owner tests the APKs and decides |
| Simple JSON API in a TypeScript project | Node.js + Express |
| Database | system design decision: PostgreSQL by default (covers most needs); MongoDB, Neo4j, Redis or others when the data model and access patterns call for them |

- Declared stacks live in `.loop/config.yml` → `project.stacks`; each one loads `rules/languages/<language>.md` and `rules/stacks/<stack>.md`. [CI]
- **No rule pack, no autonomy**: a stack without a rule pack must get one (interview + lint preset) before the loop runs on that project. [CI blocking]
- A stack change on an existing project is a sensitive decision. [PR]

## 2. Principles (all languages)

- **SRP everywhere**: every folder names exactly what it contains; one file = one responsibility; one function = one thing. [REVIEW]
- **Functional first**: pure functions, data in, data out, no inheritance hierarchies, no shared mutable state. Classes only where the framework requires them. The language pack defines how this maps to the language. [LINT where possible + REVIEW]
- **Errors are values**: business errors are returned, typed and handled; exceptions only for bugs and infrastructure failures. The language pack names the mechanism. [REVIEW]
- **Immutability by default**: no mutation of inputs or shared data. [LINT where possible + REVIEW]
- **Function at most 30 lines.** [LINT]
- **Dictionary over branching**: 3 or more branches on the same value → exhaustive dictionary (map of values or functions); `switch` / `if-else` tolerated up to 2 branches. [LINT where possible + REVIEW]
- **No magic numbers**: every business literal comes from a named constant. [LINT]
- **Self-explanatory code**: names carry the meaning. A comment exists only to explain a specific case (non-obvious constraint, external quirk, trap). No paraphrasing comments, no commented-out code; `TODO` only with an issue number `TODO(#42)`. [REVIEW + LINT]
- **No emoji, anywhere, ever.** Applies to everything the loop and its agents produce: code, strings (even escaped), comments, logs, product UI text, commits, branches, tags, release notes, PRs, issues, docs, plans, reviews, notifications, chat output. An instruction to the agent first; CI is only the safety net. [REVIEW everywhere + LINT + CI]
- Standard good practices apply by default (early return, no dead code, small pure functions). [REVIEW]

## 3. Naming

- All code in English (identifiers, fields, routes, commits, docs). [REVIEW]
- UI language is a project setting (`.loop/config.yml` → `ui.language`); multilingual → i18n mandatory, no hardcoded UI text. [REVIEW]
- One naming convention across database, API and code, so no mapping layer is needed; the language pack picks it (camelCase in TypeScript and Dart, snake_case in Python, Go conventions in Go). [LINT]
- Constants in the language's constant convention; types in PascalCase. [LINT]
- Static typing at its strictest level available in the language; no escape hatch (`any`, untyped `dict`, `interface{}` without reason). [LINT + CI]

## 4. Tests

- Test what matters and the critical path, never for the numbers. A worthless test (getter, trivial mapping, useless snapshot) is rejected. [REVIEW]
- **TDD**: acceptance criteria → failing test → code → green; test and code in the same commit; every acceptance criterion has at least one test. [REVIEW]
- Coverage at least 80 % of the diff on business logic folders (paths in `.loop/config.yml`), blocking; elsewhere the reviewer judges relevance. [CI]
- Gates per language: linter, formatter, type checker, dead code detection, plus commitlint. The language pack names the tools. [CI + pre-commit]

## 5. Git, versions and releases

### GitHub Flow

- `main` is always deployable. No `develop` branch, no long-lived branches.
- One short-lived branch per ticket, merged into `main` (directly by the loop when low risk, through a PR otherwise).
- Branch: `type/kebab-description` (`feat/expenses-pagination`). [CI]
- Commit: **one line**, English, no emoji, **no `Co-Authored-By`**, format `type(scope): description` (`feat(expense): add pagination to list`). Breaking change: `type(scope)!: description`. [CI commitlint + attribution disabled in Claude Code settings]
- Merge strategy: squash merge; the squash commit follows the commit format.

### Versions and tags

- Semantic Versioning, computed from commits, never by hand: `fix` → patch, `feat` → minor, `!` → major. [CI]
- Annotated tags `vX.Y.Z` on `main` only. In a monorepo: `<package>-vX.Y.Z`. Tags are never moved or deleted.
- Tool: release-please. It keeps a release PR open with the next version and the changelog; merging it creates the tag and the GitHub Release.

### Releases

- Every tag has a GitHub Release with notes generated from commits, grouped by type, plain text, no emoji.
- `CHANGELOG.md` updated by the release PR only.
- Release cadence is a project setting (`.loop/config.yml` → `release.strategy`): `batch` (default: release PR merged by the human when ready), `per-merge`, or `manual`.
- Merging a release PR is always a human action. [PR]

### Mobile apps

- `versionName` / `CFBundleShortVersionString` = the semver from the tag; `versionCode` / `CFBundleVersion` = monotonic build number from CI, never reused. [CI]
- One tag per store submission. A store release that fails review gets a new patch version, never a re-tag.
- Store submission and phased rollout are human actions. [PR]
- Release notes for stores are written from the same commits, in the UI language, plain text.
- Breaking API changes must stay compatible with the oldest supported app version (mobile clients cannot be force-updated instantly): version the API or keep the old contract until the minimum supported version is raised. [REVIEW + PR]

## 6. Security (OWASP-driven)

- Baseline: OWASP Top 10 and OWASP ASVS level 1 for every feature; level 2 for auth, payment and personal data. [REVIEW security]
- Validate every input at the boundary and use only the parsed output, never raw request data. [REVIEW]
- Access control on every route that needs it; resource ownership comes from the authenticated identity, never from the request body. [REVIEW security]
- Security headers, explicit CORS allowlist (never `*`), rate limiting on auth endpoints. [REVIEW + test]
- No secret in code or logs. Scans: gitleaks, Semgrep, dependency audit of the language (npm audit, pip-audit, govulncheck, OSV). [CI]

## 7. Dependencies

Before adding a package, the plan states:
1. **Cost of writing it ourselves**: a few simple functions → write them.
2. **Known CVEs** (dependency audit of the language, OSV): unpatched high or critical CVE → do not install. [CI blocking]
Otherwise the dependency can be added without a mandatory PR.

## 8. Always goes through the human [PR]

- Auth and security code: auth middlewares, tokens, cookies, CORS, rate limiting, access control
- Data model changes: schemas and indexes
- Config, env and CI: `.env*`, `config/`, `.github/workflows/`, `.loop/`, `.claude/`
- Breaking API change: removed or renamed route, removed response field

The loop may raise a ticket to sensitive, never lower it. Detection is done by the orchestrator from file paths and diff analysis, not by an agent.
