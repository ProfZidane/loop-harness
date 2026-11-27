# loop-harness

Guarded autonomous development loop for Claude Code. Install it once, use it on any project and any stack: it takes tickets, plans, builds with TDD, runs deterministic gates, reviews code, spec and security, merges low-risk work and sends sensitive work to you.

![Pipeline](./docs/assets/pipeline.svg)

## Principles

| Principle | Meaning |
|---|---|
| Deterministic control | Agents decide inside a step. Transitions, limits and risk are code. |
| Risk only goes up | The loop can mark a ticket sensitive, never the opposite. |
| Human on what matters | Sensitive zones, core business, third parties, real trade-offs, releases. |
| No imposed stack | Chosen per project in an ADR; a stack without a rule pack gets one before the loop runs. |
| Rules as source of truth | Every agent reads `rules/`. Every rule names its enforcement: lint, CI, review or PR. |

## Layout

```
.claude-plugin/marketplace.json
plugins/loop-harness/
  .claude-plugin/plugin.json
  rules/
    core.md          language-agnostic rules, decision method, stack selection
    docs.md          documentation conventions
    loop.md          loop behaviour and limits
    languages/       one pack per language: typescript.md
    stacks/          one pack per stack: express.md, mongo.md, angular.md
  scripts/
    gates/           dependency-free checks: emoji, commit messages, branch names
    loop.mjs         orchestrator: doctor, run, status, daemon
    orchestrator/    pipeline steps, risk gates, scheduling, GitHub, git, notify, deploy adapters
    hooks/guard.mjs  PreToolUse guard: protected paths, no emoji, gates before commit
    docs/diagram.mjs renders C4 diagrams from a JSON spec in the house style
    loop-init.mjs    deterministic project setup used by the loop-init skill
  agents/            planner, plan-reviewer, builder, code-reviewer, spec-reviewer, security-reviewer
  hooks/hooks.json   registers the guard
  presets/
    eslint/          ESLint presets for the [LINT] rules, copied into projects by loop-init
  skills/
    loop-init/       sets up a project for the loop
    loop/            runs, watches and diagnoses the loop
    docs-writer/     C4 diagrams, data model, ADR, COE
  templates/         copied into a project by loop-init
    loop.config.yml  becomes .loop/config.yml
    loop/plan.md     plan structure used by the planner
    claude/          CLAUDE.md, .claude/settings.json
    github/          issue, pull request and workflow templates (gates, release, mobile build)
    release/         release-please config and manifest
    docs/            architecture.md, data-model.md, adr/, coe/
examples/
  node-api/          minimal project wired to the gates, tested in CI
.github/workflows/
  gates.yml          reusable CI gates, driven by .loop/config.yml
docs/assets/         diagrams of this repository
```

## Install

```bash
claude plugin marketplace add ProfZidane/loop-harness
claude plugin install loop-harness@loop-harness
```

## Use

1. In a project: `/loop-harness:loop-init`, then merge the setup pull request.
2. Write tickets with the issue template; label them `loop:ready`.
3. `/loop-harness:loop` to run a pass, or start the daemon from a terminal.

Phase 1 (default, `loop.autoMerge: false`): every ticket ends in a pull request you merge. Phase 2: low-risk tickets merge alone.

Remaining work is tracked in [issues](https://github.com/ProfZidane/loop-harness/issues), grouped by version label.

## License

MIT
