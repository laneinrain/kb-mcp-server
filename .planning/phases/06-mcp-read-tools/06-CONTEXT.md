# Phase 6: MCP Read Tools - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Expose `read_around` and `read_file` as MCP tools on **stdio** and **Streamable HTTP**, wired to Phase 5 `ContextService` with identical behavior, bounds, and admin-configured limits. Extend `buildMcpServer()` and `createMcpServices()` — do not duplicate Chroma/registry logic in the MCP layer.

**In scope:** MCP-07 through MCP-11; tool registration, Zod schemas, unit tests, stdio/HTTP parity, UAT checkpoint (search → read_around).

**Out of scope:** REST read endpoints (API-06), upload/delete/index MCP tools, hybrid BM25/rerank, changes to ContextService window/truncation semantics (locked in Phase 5).

</domain>

<decisions>
## Implementation Decisions

### Agent workflow hints (tool descriptions)
- **D-01:** Tool description **verbosity matches `search_knowledge`** — one concise English sentence stating purpose; parameter details live in Zod `inputSchema` (same pattern as existing `server.ts`).
- **D-02:** `read_around` description **MUST include an inline one-line example** showing `document_id` and `chunk_index` taken from a `search_knowledge` hit (e.g. hit `{ documentId: "abc", chunkIndex: 3 }` → call with `document_id="abc"`, `chunk_index=3`). Keeps style short but makes the search→expand workflow explicit for agents.
- **D-03:** Whether `read_around` prose explicitly names `search_knowledge` as the typical prerequisite step — **Claude's discretion** (prefer light mention via the inline example rather than multi-step tutorial text).
- **D-04:** Whether `read_file` description contrasts “whole document / large span” vs `read_around` “neighbors around a hit” — **Claude's discretion** (stay consistent with D-01 length if added).

### MCP tool contract (inherits Phase 3 + 5 — not re-discussed)
- **D-05:** Tool names: `read_around`, `read_file` (MCP-07, MCP-08).
- **D-06:** MCP input boundary uses **snake_case**: `document_id`, `chunk_index`, optional `window`, optional `collection` — map to `ContextService` camelCase internally (same as `top_k` → `topK` for search).
- **D-07:** Successful responses follow **`search_knowledge` pattern**: pretty JSON in `content[0].text` plus matching `structuredContent` wrapping the service result (`read_around` → structured payload from `ReadAroundResult`; `read_file` → `ReadFileResult`). Include Phase 5 metadata fields (`window_requested`, `window_applied`, `chunk_range`, `truncated`, `is_center`, etc.) — do not slim unless tests require otherwise.
- **D-08:** Errors: catch `ContextError` and return **`isError: true`** with message text (align with current `search_knowledge` handler). Optionally include `code` in JSON body if trivial; do not redesign error UX in this phase.
- **D-09:** Register tools only in `buildMcpServer()`; **stdio and HTTP share the same factory** (MCP-10). Extend `createMcpServices()` to wire `DocumentRegistry`, `SettingsStore`, and `ContextService` using the **same `DATA_DIR` / `SQLITE_PATH` as backend** so admin settings changes apply without restart (Phase 5 D-13).
- **D-10:** **Retrieval-only** — register `search_knowledge`, `read_around`, `read_file` only; no ingest/write tools (MCP-11). Update forbidden-tool tests accordingly.

### Claude's Discretion (not discussed — follow ROADMAP / Phase 5 handoff)
- Exact wording of English tool descriptions beyond D-01/D-02 constraints.
- Oversized single center chunk still exceeding char cap after Phase 5 truncation — pass through `ContextService` result unless UAT shows MCP client breakage (see 05-REVIEWS.md LOW item).
- Streamable HTTP session handling unchanged from Phase 3.
- UAT script location and assertions for search → read_around workflow (06-02 plan).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — MCP-07 through MCP-11
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria, plan stubs 06-01 / 06-02
- `.planning/PROJECT.md` — v1.1 milestone, MCP retrieval-only, dual transport

### Prior phase context
- `.planning/phases/05-context-retrieval-core/05-CONTEXT.md` — D-01–D-13 window/truncation/settings; ContextService behavior
- `.planning/phases/05-context-retrieval-core/05-REVIEWS.md` — MCP wiring prerequisite, center-chunk size note
- `.planning/phases/03-mcp-search-server/03-CONTEXT.md` — buildMcpServer factory, search tool JSON shape, stderr-only stdio

### Code (integration points)
- `apps/mcp-server/src/server.ts` — extend `buildMcpServer`; description/style reference for D-01
- `apps/mcp-server/src/services.ts` — add ContextService + registry + settingsStore wiring
- `apps/mcp-server/src/server.test.ts` — tool list, delegation, forbidden write tools
- `apps/mcp-server/src/http.ts` — HTTP transport parity
- `apps/backend/src/services.ts` — backend wiring pattern for ContextService
- `packages/core/src/context/context-service.ts` — readAround / readFile implementation
- `packages/core/src/context/types.ts` — result shapes for structuredContent
- `packages/core/src/context/errors.ts` — ContextError codes for MCP mapping

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ContextService.readAround()` / `readFile()` — Phase 5 complete; MCP tools delegate here
- `buildMcpServer(searchService)` — extend signature to accept `ContextService` (or combined deps object)
- `createMcpServices()` — today only SearchService; mirror backend subset: registry + settingsStore + vectorStore (no embedding needed for read tools if getByIds only — verify planner uses same deps as backend ContextService)
- `server.test.ts` — InMemoryTransport client pattern for new tool tests

### Established Patterns
- MCP tool handler: try/catch → `{ content, structuredContent }` or `{ content, isError: true }`
- snake_case MCP inputs; camelCase in `@kb/core` services
- Forbidden ingest/write tool names grep-tested in `server.ts`
- Admin settings in SQLite; `ContextService` reads live on each call

### Integration Points
- `apps/mcp-server/src/services.ts` — must share SQLite path with backend for operator settings parity
- Root `pnpm dev` — MCP HTTP on 3100 alongside backend; UAT uses live stack
- Phase 6 UAT: `search_knowledge` → `read_around` with `document_id` + `chunk_index` from hit

</code_context>

<specifics>
## Specific Ideas

- User chose **inline example in `read_around` description** after clarification of “Agent 工作流提示” — critical for Phase 6 UAT and real Cursor usage.
- Description language: **English** at MCP tool boundary (matches existing `search_knowledge`); Web admin remains zh-CN.
- User preferred **same brevity as search_knowledge**, not tutorial-style multi-step descriptions.

</specifics>

<deferred>
## Deferred Ideas

- REST parity for read tools (API-06) — future requirement
- MCP HTTP bearer auth — Phase 4 deferred
- Hybrid BM25 / rerank / multi-collection — out of v1.1
- Detailed discuss of MCP error format, response slimming, center-chunk hard cap — deferred to Claude's discretion per ROADMAP defaults

</deferred>

---

*Phase: 6-MCP Read Tools*
*Context gathered: 2026-07-05*
