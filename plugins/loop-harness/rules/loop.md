# Loop behaviour

The orchestrator owns the state machine. Agents work freely inside a step; transitions, limits and risk classification are code, never an agent decision.

## Pipeline

```
issue loop:ready
  → PLANNER            plan.md (+ HTML mockup if UI) with files to touch, risks, tests to write
  → PLAN GATE          human review if a trigger fires, else PLAN REVIEWER (core.md §0)
  → BUILDER            TDD in its own git worktree and branch
  → DETERMINISTIC GATES lint, tsc, tests, coverage, knip, gitleaks, semgrep, npm audit
  → REVIEWERS          code conformity · spec conformity · security (fresh context, diff + ticket + rules only)
  → FIX                max 3 review/fix iterations
  → RISK CLASSIFIER    paths + diff analysis (core.md §8)
  → low risk: merge to main     sensitive: PR + human reviewer + notification
  → DEPLOY CHECK       Vercel / Railway CLI
  → issue loop:done    + docs updated (architecture, data-model, ADR)
  → RELEASE            release-please keeps the release PR up to date; the human merges it → tag + GitHub Release
```

## Ticket source

- Default adapter: **GitHub Issues**. Status through labels: `loop:ready` → `loop:planning` → `loop:awaiting-plan` → `loop:in-progress` → `loop:awaiting-review` → `loop:done` | `loop:blocked` | `loop:question`.
- Ticket template: context, acceptance criteria, out of scope.

## Triggers

- Ticket-driven: the orchestrator polls `loop:ready` issues every 5 minutes (no webhook, the loop runs locally).
- Modes, combinable in `.loop/config.yml`: manual `loop run`, continuous daemon, time window.

## Parallelism

- Up to **3 tickets** at once, one git worktree each.
- Conflict guard: the planner lists the files it will touch; a ticket whose files overlap an active ticket waits in queue. Merge conflict anyway → one automatic rebase, else `loop:blocked` + notification.

## Ambiguity

- Ambiguous or incomplete ticket → questions as an issue comment + notification, label `loop:question`; the loop moves to the next ticket and resumes when answered.

## Plan gate: human validation (plan + static HTML mockup for UI)

Triggered when any of these is true:
- a sensitive zone is touched (core.md §8);
- the planner found ≥ 2 viable approaches with real trade-offs (the human choice becomes an ADR);
- core business: issue labelled `core-business`, or plan touches `coreBusiness.paths` from `.loop/config.yml`;
- third-party integration (Stripe…): new third-party SDK, new API-key env var, inbound webhook, outbound call to a new domain.

Otherwise the plan reviewer decides alone.

## Review/fix

- **Max 3 iterations**, then `loop:blocked`, full report on the issue, notification.

## Notifications

- **GitHub review request** on every sensitive PR (native GitHub email).
- **ntfy.sh** push for urgent events: deploy failure, blocked, question, plan awaiting validation.
- **Gmail SMTP** (app password) for detailed recaps: plan, review report, links.

## Failed deploy (checked by CLI after every merge)

1. Immediate ntfy: "deploy failed, fix in progress".
2. Hotfix issue created with logs.
3. FULL loop on the hotfix, no shortcut.
4. One attempt, 30-minute timeout.
5. Fix OK → merge → deploy → notification "restored".
6. Fix KO → revert the original merge → notification. If the original merge touched a sensitive zone: no automatic revert, urgent notification, human decides.
7. A COE is written in `docs/coe/` in every case.
