---
name: loop
description: Run, watch or check the loop-harness autonomous loop on the current project - process ready tickets, start the daemon, show ticket status, or diagnose the setup. Use when the user asks to run the loop, start it, check its status or why it does not run.
---

# loop

Orchestrator: `node "${CLAUDE_PLUGIN_ROOT}/scripts/loop.mjs" <command> <projectDir>`

| Command | What it does |
|---|---|
| `doctor` | Checks claude CLI, gh login, git remote, rule packs. Every run starts with it and stops if it fails. |
| `run` | One pass: plans up to `loop.maxParallel` ready tickets, builds the ones that do not share files, reviews, ships. |
| `status` | Issue numbers per `loop:*` label. |
| `usage` | Last known Claude quota (five-hour and weekly windows) and whether the loop is paused. `--probe` refreshes it with one tiny call. |
| `daemon` | `run` every `tickets.pollMinutes`, inside `loop.modes.window` if set. Long-running: start it from a terminal, not from this session. |

## How to answer the user

- `doctor` or `status`: run it and report as a short table. No emoji.
- `run`: it consumes the owner's Claude subscription quota. Run `usage` first and report it; the loop pauses by itself at `loop.quota` thresholds (90 % by default). Then run it and report each ticket outcome with its issue link.
- `daemon`: do not start it here. Give the user this command for their terminal:
  `node "${CLAUDE_PLUGIN_ROOT}/scripts/loop.mjs" daemon .`
  and suggest an alias, for example `alias loop='node "${CLAUDE_PLUGIN_ROOT}/scripts/loop.mjs"'`.

## Ticket labels the owner uses

| Label | Meaning |
|---|---|
| `loop:ready` | Start or retry this ticket |
| `loop:plan-approved` | The owner validated the plan posted on the issue: build it |
| `core-business` | Force plan validation by the owner |
| `hotfix` | Created by the loop after a failed deploy; processed first |

Outcomes are posted on the issue: questions, plan to validate, pull request to review, blocked reason, done. Run logs: `~/.loop-harness/runs/<repo>/<issue>/log.jsonl`.
