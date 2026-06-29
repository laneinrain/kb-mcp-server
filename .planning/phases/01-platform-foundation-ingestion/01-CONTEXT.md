# Phase 1: Platform Foundation & Ingestion - Context

**Gathered:** 2026-06-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a runnable local foundation: TypeScript monorepo scaffold, environment configuration, Chroma HTTP sidecar integration, and a complete ingestion pipeline (parse → chunk → embed → store) for txt, markdown, and text-layer PDF files. Includes health checks for Chroma and embedding connectivity. Does NOT include REST CRUD (Phase 2), MCP server (Phase 3), or Web/CLI admin surfaces (Phase 4).

</domain>

<decisions>
## Implementation Decisions

### Chunking Strategy (discussed)
- **D-01:** Default chunk size = **1024 tokens** (~4000 characters)
- **D-02:** Default overlap = **15%** (~150 tokens)
- **D-03:** Markdown uses **fixed sliding window** in v1 (same as txt/PDF); heading-aware chunking deferred to v1.x
- **D-04:** Chunk configuration must be **editable via Web UI** (Phase 4); Phase 1 establishes persisted `ChunkConfig` with env bootstrap defaults
- **D-05:** Web-saved chunk settings apply to **subsequent ingests only** (existing vectors not auto-reindexed unless explicitly triggered later)

### Configuration Persistence (derived from D-04)
- **D-06:** Store `ChunkConfig` (size, overlap) in SQLite settings table (or equivalent persisted store) readable by ingestion pipeline
- **D-07:** Environment variables (`CHUNK_SIZE`, `CHUNK_OVERLAP`) provide **initial defaults** on first run before any Web UI edit

### Claude's Discretion (undiscussed areas — use research defaults)
- **Monorepo layout:** pnpm + Turborepo with `packages/core` (domain logic), `packages/config` (Zod env), thin apps deferred to later phases; Phase 1 focuses on core + dev scripts
- **Document registry:** SQLite (`better-sqlite3`) for document metadata alongside Chroma vectors
- **Phase 1 ingest entrypoint:** Dev CLI/script invoking `IngestionService` directly (no REST until Phase 2)
- **Data paths:** `./data/chroma` (Chroma persistence), `./data/sqlite` (registry/settings)
- **Dev UX:** `pnpm dev` starts Chroma sidecar via `concurrently` + health probe script
- **PDF rejection threshold:** Reject when extracted text < 50 characters OR < 10% of page count (whichever stricter); English error messages in v1 scaffold

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — Core value, stack constraints, key decisions
- `.planning/REQUIREMENTS.md` — Phase 1 requirements: CONF-01/02/04, INGE-01–09, API-05
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, research flags

### Research (stack & pitfalls)
- `.planning/research/SUMMARY.md` — Consolidated architecture and build order
- `.planning/research/STACK.md` — Recommended libraries and versions
- `.planning/research/ARCHITECTURE.md` — Dual-pipeline RAG, component boundaries
- `.planning/research/PITFALLS.md` — Chroma sidecar, stdout pollution, embedding mismatch, PDF ghosts

No external ADRs or third-party spec files in repo — requirements fully captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

Greenfield repository — no application code yet.

### Reusable Assets
- None — first implementation phase

### Established Patterns
- Follow research SUMMARY.md monorepo layout and Chroma HTTP sidecar pattern from day one

### Integration Points
- CherryIn OpenAI-compatible API at `https://open.cherryin.cc` for embeddings
- Chroma REST client connecting to local sidecar (`npx chroma run --path ./data/chroma`)

</code_context>

<specifics>
## Specific Ideas

- User wants chunk size/overlap configurable on **Web admin settings page** (Phase 4); Phase 1 must not hardcode-only — persist settings for future Web binding
- Embedding model fixed: `qwen/qwen3-embedding-8b` via CherryIn

</specifics>

<deferred>
## Deferred Ideas

### From discussion (other gray areas not selected)
- Monorepo package split granularity — use research default unless planner identifies issues
- PDF page-aware chunking vs unified window — unified window for v1
- Heading-aware markdown chunking — v1.x enhancement

### Web UI chunk config (Phase 4 scope)
- Settings page UI for chunk size/overlap lives in Phase 4; Phase 1 only needs persisted schema + env defaults

</deferred>

---
*Phase: 1-Platform Foundation & Ingestion*
*Context gathered: 2026-06-29*
