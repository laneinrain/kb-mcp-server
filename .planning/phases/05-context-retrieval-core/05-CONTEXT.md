# Phase 5: Context Retrieval Core - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver `ContextService` that reads chunk text from the same Chroma collection and SQLite document registry as `SearchService`, with bounded `read_around` / `read_file` logic, structured errors, unit tests, **and** a Web admin settings surface so operators can configure context-retrieval limits without code changes.

Phase 5 is core + admin configurability. MCP tool registration remains Phase 6.

</domain>

<decisions>
## Implementation Decisions

### read_around window semantics
- **D-01:** `window` is **symmetric ±N** around `chunk_index` — e.g. center=4, window=2 → indices 2,3,4,5,6 (up to 2×window+1 chunks).
- **D-02:** Default `window` = **1**; maximum allowed `window` = **3**.
- **D-03:** Requests above max are **silently clamped** to max (no error). Response metadata includes `window_requested` and `window_applied`.
- **D-04:** At document boundaries, return as many chunks as exist (**shrink**); do not error. Response includes `chunk_range: { start, end }` (inclusive chunk indices actually returned).
- **D-05:** Chunks in response are ordered by **`chunk_index` ascending** (0,1,2…).
- **D-06:** The requested `chunk_index` (**center**) is **always included** when the document exists and the index is valid. Mark it with `is_center: true` on that chunk object.
- **D-07:** Each chunk returns **full stored text** from Chroma (not the 500-char search snippet). Whole-response size is still bounded (D-08).
- **D-08:** `read_around` total response character cap = **32_000** (configurable via admin settings). If exceeded, truncate from the **far end of the window** (highest/lowest index away from center first) and set truncation metadata.

### Admin settings (grouped configuration)
- **D-09:** Context-retrieval limits are **operator-configurable** via Web admin (简体中文 UI), grouped under a dedicated section e.g. **「上下文检索」**, separate from ingestion chunk settings (**「分块」** or existing chunk group).
- **D-10:** Persist settings in SQLite `settings` table (extend schema alongside existing `chunk_size` / `chunk_overlap`), seeded from env defaults on first boot — same pattern as `settings-store.ts`.
- **D-11:** Configurable fields (minimum set):
  - `read_around_window_default` (default 1)
  - `read_around_window_max` (default 3)
  - `read_around_max_chars` (default 32000)
  - `read_file_max_chunks` (planner picks safe default, e.g. 50)
  - `read_file_max_chars` (planner picks safe default, e.g. 64000)
- **D-12:** Backend exposes **GET/PATCH `/api/v1/settings`** (or scoped sub-routes) for read/update; auth follows existing Bearer gate when `AUTH_ENABLED`.
- **D-13:** `ContextService` reads live settings from `SettingsStore` on each call (no restart required after admin save).

### Claude's Discretion (not discussed — follow ROADMAP / CORE-01/02 / MCP-09)

**Data fetch path**
- Use `DocumentRegistry.getChunkIds(documentId)` for ordered indices, then batch-fetch documents from Chroma by ID (`{documentId}:{chunkIndex}`). Add `getChunksByIds` (or equivalent) to `ChromaVectorStore` if missing.

**Errors (CORE-02)**
- Unknown `document_id` → structured error, **no partial chunks**.
- Out-of-range `chunk_index` → structured error, **no partial chunks**.
- Match existing MCP/backend JSON error style (clear `code` + `message` fields).

**read_file bounds**
- Return all chunks in `chunk_index` order with `read_file_max_chunks` and `read_file_max_chars` from settings; truncation metadata when limits hit.

**collection parameter**
- Optional `collection`, default `default` — same as `SearchService` / `search_knowledge`.

**Web UI placement**
- New settings panel or section in Web admin (Phase 4 shell); grouped fields with validation (max ≥ default, positive integers).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — CORE-01, CORE-02, MCP-09 (configurable bounds)
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, plan stubs 05-01 / 05-02
- `.planning/PROJECT.md` — v1.1 milestone scope, read_around / read_file intent

### Prior phase context
- `.planning/phases/03-mcp-search-server/03-CONTEXT.md` — MCP retrieval-only, search tool JSON shape, collection default
- `.planning/phases/01-platform-foundation-ingestion/01-CONTEXT.md` — D-03 fixed sliding-window chunking; chunk_index 0-based ordering

### Code (integration points)
- `packages/core/src/search/search-service.ts` — SearchService pattern, 500-char snippet (search only)
- `packages/core/src/vector-store/chroma-store.ts` — Chroma upsert/query; needs fetch-by-id extension
- `packages/core/src/registry/document-registry.ts` — `getChunkIds`, ordered chunk_index
- `packages/core/src/registry/settings-store.ts` — settings seed/read pattern
- `packages/core/src/registry/schema.sql` — settings + document_chunks schema
- `apps/backend/src/services.ts` — wires settingsStore + registry
- `apps/web/src/` — admin UI (简体中文); add grouped settings section

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DocumentRegistry.getChunkIds(documentId)` — returns ordered Chroma IDs for window/range computation
- `ChromaVectorStore.query()` — semantic search; parallel new method for ID batch get
- `SettingsStore` + `schema.sql` settings row — extend for context-retrieval columns
- `SearchService` — constructor/factory pattern for `ContextService.create(config, deps)`
- Web admin components (DocumentTable, SearchPanel) — layout/styling reference for new SettingsPanel

### Established Patterns
- Chunk IDs: `{documentId}:{chunkIndex}` via `buildChunkId`
- Single settings row `id = 1`; env seeds defaults on first boot
- Backend routes under `/api/v1/*` with optional Bearer auth
- JSON structured tool responses in MCP (`structuredContent` + text JSON)

### Integration Points
- `apps/backend/src/services.ts` — inject ContextService alongside SearchService
- MCP server (Phase 6) will consume ContextService; Phase 5 exposes service + settings API only
- Admin UI saves settings → SQLite → ContextService reads on next MCP/backend call

</code_context>

<specifics>
## Specific Ideas

- User explicitly requested **后台页面分组配置** for window/char limits — not hard-coded constants only.
- `read_around` exists to expand **search snippets** into readable context; full chunk text is intentional.
- Symmetric window aligns with ROADMAP "±N neighbors" and Agent mental model after `search_knowledge` hit.

</specifics>

<deferred>
## Deferred Ideas

- MCP tool registration (`read_around`, `read_file`) — **Phase 6**
- REST parity endpoints for read tools (API-06) — future requirement, not Phase 5
- Hybrid BM25 / rerank / multi-collection — out of v1.1 scope

</deferred>

---

*Phase: 5-Context Retrieval Core*
*Context gathered: 2026-07-05*
