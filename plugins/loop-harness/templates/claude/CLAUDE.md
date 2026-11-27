# Project rules

This project runs under loop-harness. Rules are loaded from the plugin; this file only holds project-specific facts.

## Hard rules

- Never write an emoji: not in code, strings, comments, logs, UI text, docs, commits, PRs, issues or messages. Not even escaped (`\u{...}`).
- Docs and code in English, short and plain. No decorative symbols, no ASCII diagrams (SVG only).
- Commits: one line, `type(scope): description`, no `Co-Authored-By`.

@.loop/rules/core.md
@.loop/rules/docs.md
@.loop/rules/loop.md

## Language and stack rules

<!-- loop-init writes one import per language and stack declared in .loop/config.yml -->
@.loop/rules/languages/typescript.md
@.loop/rules/stacks/express.md
@.loop/rules/stacks/mongo.md
@.loop/rules/stacks/angular.md

## Project facts

- Domain:
- Core business modules:
- Third-party services:
- Critical user paths:
