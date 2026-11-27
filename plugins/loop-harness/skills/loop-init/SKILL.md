---
name: loop-init
description: Set up the current project for the loop-harness autonomous loop. Use when the user asks to init, install or set up loop-harness or the loop on a project.
---

# loop-init

Sets up the current project so the loop can run on it. File writes are done by a deterministic script; your job is to detect, ask what cannot be detected, and fill the config.

Script: `node "${CLAUDE_PLUGIN_ROOT}/scripts/loop-init.mjs" <detect|check|apply> <projectDir>`

Never write an emoji in anything you produce here. Keep every text short, plain, in English, except UI-facing values.

## Steps

1. **Branch.** Create `chore/loop-init` from an up-to-date `main`. Stop if the working tree is dirty.

2. **Detect.** Run `detect .`. It returns `languages`, `stacks`, `hasTests`, `hasCi`, `hasLoopConfig`.

3. **Confirm the stack with the owner** in one AskUserQuestion call. Show what was detected and let them correct it. No stack is imposed (rules/core.md, section 1).

4. **Rule packs.** Every language and stack needs a pack. If `apply` would miss one, stop and tell the owner: "No rule pack, no autonomy". Offer to run the pack interview, or point to the matching `rule-pack` issue in the loop-harness repository. Do not continue.

5. **Apply.** Run `apply . --languages <a,b> --stacks <x,y>`. It is idempotent:
   - managed files, refreshed on every run: `.loop/rules/`, `.loop/gates/`, `.githooks/`, the loop-harness block in `CLAUDE.md`, the attribution and deny rules in `.claude/settings.json`;
   - seeded files, created only if absent: `.loop/config.yml`, GitHub templates and workflows, release-please files, docs skeleton;
   - `git config core.hooksPath .githooks`.
   Report the file list to the owner as a short table.

6. **Fill `.loop/config.yml`.** Edit values only, never the structure.
   - `commands`: take them from the project itself (`package.json` scripts, `pyproject.toml`, Makefile). Leave a command empty rather than invent one.
   - Ask the owner, in at most two AskUserQuestion calls, what cannot be read from the code: UI language and multilingual, critical user paths, core business paths, auth transport, deploy targets, GitHub login for reviews, ntfy topic, recap email, release strategy, mobile minimum supported version.
   - Secrets never go in the file: only the names of the environment variables that hold them.

7. **Tests.** If `hasTests` is false, open one issue in the project: `test(bootstrap): cover critical paths`, label `loop:ready`, one acceptance criterion per critical path. Testing the important paths only, not for the numbers (rules/core.md, section 4).

8. **Check.** Run `check .`. It must report no missing pack.

9. **Pull request.** Commit with `chore(loop): set up loop-harness`, push, open a pull request. This change touches `.loop/`, `.claude/` and workflows, so it is sensitive: request the owner as reviewer, never merge it yourself.

10. **Tell the owner** the two manual settings left on GitHub:
    - branch protection on `main` requiring `gates / quality`, `gates / security`, `gates / conventions`;
    - Settings > Actions > General: allow GitHub Actions to create and approve pull requests (release-please).
