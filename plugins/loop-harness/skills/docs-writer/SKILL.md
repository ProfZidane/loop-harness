---
name: docs-writer
description: Write or update project documentation the loop-harness way - C4 architecture diagrams as SVG, UML-style data model, ADRs and COEs. Use when a change adds, removes or rewires a container or component, changes the data model, settles a trade-off, or follows an incident.
---

# docs-writer

Follow `.loop/rules/docs.md`. English, short, schematic. No emoji, no decorative symbols, no ASCII diagrams. If a sentence carries no fact or decision, delete it.

## Architecture (docs/architecture.md)

C4 levels: C1 Context, C2 Containers, C3 Components (only for containers with real internal structure).

Never hand-write diagram SVG. Each diagram has a JSON spec next to its SVG and is rendered by the house renderer:

```
docs/assets/c2-containers.json   source of truth, edit this
docs/assets/c2-containers.svg    generated, never edited by hand
```

Render: `node "${CLAUDE_PLUGIN_ROOT}/scripts/docs/diagram.mjs" docs/assets/c2-containers.json docs/assets/c2-containers.svg`

Spec format (example: `${CLAUDE_PLUGIN_ROOT}/skills/docs-writer/c2-example.json`):

| Field | Meaning |
|---|---|
| `title`, `subtitle` | `C2: Containers`, then one line on what the diagram shows |
| `boundary` | optional dashed system boundary: `label`, `x`, `y`, `width`, `height` |
| `nodes[]` | `id`, `kind`, `title`, `tech` (shown in brackets), optional `desc`, `x`, `y` |
| `edges[]` | `from`, `to`, `label` (protocol or purpose), optional `async: true` (dashed) |

Kinds: `person`, `system`, `container`, `component`, `database`, `external`. The renderer adds icons, colors and the legend.

Layout: left to right following the main flow (actors, front, back, data, third parties). Grid of about 300 px horizontally and 150 px vertically. Render, then look at the result (convert to PNG if needed) before committing: no overlapping boxes, every label readable.

Under each diagram, a `Notes:` list of 1 to 5 facts that back it up: protocols, why a boundary exists, constraints. Nothing that the diagram already says.

## Data model (docs/data-model.md)

- One Mermaid `classDiagram` (rendered natively by GitHub): entities, typed fields, relations with cardinality, and for document databases whether each relation is a reference, an embedding or a snapshot.
- A `Physical` table: collection or table, indexes, shard or partition key, retention.
- A `Cross-database links` section when more than one store exists (cache, search, graph).
- Update it in the same pull request as any schema or index change.

## ADR (docs/adr/NNNN-slug.md)

Template: `${CLAUDE_PLUGIN_ROOT}/templates/docs/adr/0000-template.md`. Next free number, kebab-case slug. Write one when the owner chooses between approaches or a reviewer settles a real trade-off. Never edit an accepted ADR: supersede it with a new one and update the old status line.

## COE (docs/coe/YYYY-MM-DD-slug.md)

Template: `${CLAUDE_PLUGIN_ROOT}/templates/docs/coe/0000-template.md`. Blameless. Timeline in UTC from logs, five whys down to a root cause the team controls, and the section "Why the gates did not catch it". Every action becomes an issue; link it.

## Before finishing

- Every diagram re-rendered from its spec, SVG and JSON committed together.
- No emoji in any file you touched.
- Commit: `docs(<scope>): <what changed>`, one line.
