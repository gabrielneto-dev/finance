# Context Memory System

`Context/` is the persistent memory layer for this repository. It stores durable project knowledge so a new agent session can recover only the context it needs without depending on prior chat history.

## Sources of truth

- `../AGENTS.md`: shared operating rules for agents
- `MAP.md`: routing layer for context discovery
- `STATE.md`: current operational state
- `core/`: stable project fundamentals
- `branches/`: domain-specific memory
- `global/`: cross-cutting assumptions, questions, risks, plans, decisions
- `checkpoints/`: compact continuity snapshots
- `sources/`: provenance and evidence
- `_meta/`: taxonomy, catalog, config, and maintenance metadata

## Retrieval protocol

1. Understand the task and infer likely branches, tags, and record types.
2. Read `MAP.md` and `STATE.md`.
3. Read only relevant branch `_index.md` files.
4. Search for atomic records by ID, title, tags, type, status, or keywords.
5. Expand to related records only when those relations materially affect the task.
6. Load `sources/` only when evidence or temporal validation is needed.

## Record types

Canonical types:

- `fact`
- `research`
- `decision`
- `assumption`
- `question`
- `plan`
- `risk`
- `note`
- `source`
- `summary`
- `experiment`
- `checkpoint`

## Metadata schema

Every atomic record uses YAML frontmatter. Minimum fields:

- `id`
- `type`
- `title`
- `branch`
- `tags`
- `status`
- `created_at`
- `updated_at`

Optional fields include `confidence`, `source_ids`, `related`, `depends_on`, `supersedes`, `superseded_by`, `valid_from`, `valid_until`, and `revisit_at`.

## Naming

- Files: `<TYPE>-<YYYYMMDD>-<slug>.md`
- IDs: `CTX-<TYPE>-<YYYYMMDD>-<slug>`
- Tags: `kebab-case`

## Save protocol

The intent `salvar contexto` triggers controlled persistence:

1. Inspect project changes and current files.
2. Distill durable knowledge from the session and repository state.
3. Deduplicate against existing context records.
4. Update or create atomic records.
5. Create a checkpoint in `checkpoints/`.
6. Refresh `STATE.md`, branch indexes, `MAP.md`, and `_meta/catalog.jsonl` as needed.
7. Evaluate whether any durable operating rule belongs in `AGENTS.md`.

Do not store chat transcripts verbatim.

## Semantic commands

- `salvar contexto`: persist durable session knowledge and create a checkpoint
- `carregar contexto`: explicitly reload `MAP.md`, `STATE.md`, and relevant branches
- `buscar contexto <assunto>`: search memory by tags, titles, IDs, or content
- `status do contexto`: summarize state, branches, latest checkpoint, blockers, and critical questions
- `auditar contexto`: inspect IDs, references, taxonomy drift, stale state, and structural issues

## Checkpoints

Checkpoints capture continuity snapshots. They do not replace atomic records. Durable knowledge should also live in its proper type-specific location.

## Supersession and archive

When knowledge becomes obsolete, prefer marking it `superseded` and linking the successor via `superseded_by`. Use `archive/` only for inactive material with historical value.

## Security

Never persist secret values in `Context/`. Safe references to secret names or storage locations are allowed.

## Maintenance and audit

During audits, verify:

- duplicate IDs
- missing referenced IDs
- stale `STATE.md`
- outdated routes in `MAP.md`
- taxonomy drift
- contradictory active records
- accidental secret persistence

## Adding branches

Create a new branch only when the repository shows a distinct knowledge area that benefits from separate routing and records.

## Conflict handling

When records conflict, compare date, source, scope, confidence, and current validity. If ambiguity remains, create or update a `question` record rather than silently choosing one side.

## Rebuilding the catalog

`_meta/catalog.jsonl` should contain one JSON object per durable context record. Rebuild it whenever records are added, removed, renamed, or materially reclassified.
