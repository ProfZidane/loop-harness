# loop-harness

A guarded autonomous development loop for Claude Code. Drop it on any project: it takes tickets, plans, builds with TDD, runs deterministic gates, reviews code, spec and security, merges low-risk work and sends sensitive work to you.

Claude does the thinking inside each step. Transitions, limits and risk classification are code, never an agent decision.

## Pipeline

```
issue loop:ready
  → planner ─→ plan gate (human if sensitive / core business / third party / real trade-off)
  → builder (TDD, own worktree)
  → deterministic gates: lint · tsc · tests · diff coverage · knip · gitleaks · semgrep · npm audit
  → reviewers: code · spec · security (fresh context)
  → fix (max 3)
  → risk classifier ─→ low: merge main │ sensitive: PR + notify
  → deploy check (Vercel / Railway) ─→ KO: one guarded hotfix, else revert + COE
```

## Layout

```
.claude-plugin/marketplace.json      marketplace (this repo)
plugins/loop-harness/
├── .claude-plugin/plugin.json
├── rules/                           source of truth for every agent
│   ├── core.md                      stack-agnostic rules and decision method
│   ├── docs.md                      documentation conventions (C4, data model, ADR, COE)
│   ├── loop.md                      loop behaviour and limits
│   └── stacks/                      express.md · mongo.md · angular.md
└── templates/                       copied into a project by /loop-init
    ├── loop.config.yml              → .loop/config.yml
    ├── claude/                      → CLAUDE.md, .claude/settings.json
    ├── github/                      → issue template, PR template
    └── docs/                        → architecture.md, data-model.md, adr/, coe/
```

## Install

```bash
claude plugin marketplace add <owner>/loop-harness
claude plugin install loop-harness@loop-harness
```

Then in a project: `/loop-harness:loop-init` (coming in v0.2).

## Status

v0.1: rules and templates. See [ROADMAP.md](./ROADMAP.md).

## License

MIT
