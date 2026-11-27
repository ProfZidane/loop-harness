# Loop behaviour

The orchestrator owns the state machine. Agents work freely inside a step; transitions, limits and risk classification are code, never an agent decision.

## Pipeline

| Step | Owner | Output |
|---|---|---|
| 1. Ticket | GitHub issue `loop:ready` | context, acceptance criteria, out of scope |
| 2. Planner | agent | plan.md: approach, files to touch, risks, tests per criterion, HTML mockup if UI |
| 3. Plan gate | human if a trigger fires, else plan reviewer agent | approved plan, ADR if a trade-off was settled |
| 4. Builder | agent | TDD commits in its own worktree and branch |
| 5. Gates | deterministic | lint, tsc, tests, diff coverage, knip, gitleaks, semgrep, npm audit |
| 6. Reviewers | 3 agents, fresh context | code, spec and security verdicts |
| 7. Fix | builder agent | max 3 review/fix iterations |
| 8. Risk classifier | deterministic | low risk: merge to main; sensitive: PR + human reviewer + notification |
| 9. Deploy check | deterministic | Vercel and Railway status |
| 10. Done | orchestrator | issue `loop:done`, docs updated |
| 11. Release | release-please + human | release PR merged by the human, tag and GitHub Release |

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
- a sensitive zone is touched (core.md section 8);
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
