# Documentation rules

All docs in English. Clear, short, schematic. No filler: if a sentence does not carry a fact or a decision, delete it.

## Layout

```
docs/
├── architecture.md      C4 model: schematic SVG with icons + short notes under each diagram
├── data-model.md        UML-style data model: entities, fields, relations, indexes, sharding, DB links
├── adr/                 one architecture decision per file
│   └── 0001-<slug>.md
├── coe/                 Correction of Error, one incident per file
│   └── 2026-11-27-<slug>.md
├── assets/              SVG diagrams referenced by the docs
└── <project-specific>.md   only when needed (e.g. evaluation.md for a RAG / AI evaluation protocol)
```

## architecture.md

- C4 levels: **C1 Context**, **C2 Containers**, **C3 Components** (one per container that has real internal structure). No C4 code level.
- Each level = one SVG in `docs/assets/` (real schematic, icons for actors, apps, databases, third parties), embedded in the Markdown.
- Under each diagram: a short `Notes` list that backs up key facts (protocols, why a boundary exists, constraints).
- Updated in the same PR as any change that adds, removes or rewires a container or component. [REVIEW]

## data-model.md

- One UML-style class diagram (SVG or Mermaid `classDiagram`): entities, typed fields, relations with cardinality, embedded vs referenced vs snapshot.
- Separate section for physical concerns: indexes, sharding keys, cross-database links, retention.
- Updated in the same PR as any schema or index change. [REVIEW]

## adr/

- One file per decision, numbered, never edited after acceptance (superseded by a new ADR instead).
- Written by the loop whenever the human chooses between approaches at plan review, or the plan reviewer settles a real trade-off.
- Template: `templates/docs/adr/0000-template.md`.

## coe/

- Written by the loop after every production incident it detects (failed deploy, hotfix, revert), and on demand.
- Blameless; focused on root cause and prevention actions that become tickets.
- Template: `templates/docs/coe/0000-template.md`.
