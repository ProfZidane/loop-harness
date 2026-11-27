# Roadmap

## v0.1 — Rules and templates (done)

- Rules: core, docs, loop, stacks (express, mongo, angular)
- Templates: loop config, CLAUDE.md, settings, issue and PR templates, docs (architecture, data model, ADR, COE)

## v0.2 — Deterministic gates

- `@loop-harness/eslint-config`: every [LINT] rule as a shareable config (functional, dictionary, naming, layering, Angular)
- commitlint config, knip config, gitleaks + semgrep CI workflow
- `/loop-init`: detect stack, generate `.loop/config.yml`, install gates, bootstrap tests if missing

## v0.3 — Agents and skills

- Agents: planner, plan-reviewer, builder, code-reviewer, spec-reviewer, security-reviewer
- Skills: one per stack, docs writer (C4 SVG, data model, ADR, COE)
- Hooks: block commit on red gates, block edits to protected paths

## v0.4 — Orchestrator

- TypeScript CLI on the Claude Agent SDK: state machine, worktrees, parallelism with file-overlap guard, limits, logs
- Adapters: tickets (github-issues, trello, markdown), notify (github, ntfy, smtp), deploy (vercel, railway)

## v0.5 — Autonomy phase 2

- Auto-merge for low-risk tickets after a trust threshold
- Guarded hotfix on failed deploy + automatic COE
