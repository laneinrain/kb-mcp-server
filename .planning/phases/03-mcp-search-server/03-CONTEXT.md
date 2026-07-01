# Phase 3: MCP Search Server - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning (research defaults — no interactive discuss)

<domain>
## Phase Boundary

Add `apps/mcp-server` exposing **retrieval-only** semantic search to MCP clients via stdio and Streamable HTTP. Wire `SearchService` from `@kb/core` (Phase 2) — no duplicate Chroma or embedding logic in the MCP layer. Single `buildMcpServer()` factory shared by both transports for schema and behavior parity.

**In scope:** MCP-01 through MCP-06, `search_knowledge` tool, stdio + Streamable HTTP entrypoints, `createMcpServices()`, config for MCP HTTP bind, unit tests, human E2E checkpoint.

**Out of scope:** Upload/delete/index MCP tools (MCP-05 negative scope), REST changes, web admin (Phase 4), CLI (Phase 4), optional API key auth (Phase 4 / CONF-03), `read_around` / `read_file` tools (v2 RETR-03), legacy SSE-only transport as primary path.

</domain>

<decisions>
## Implementation Decisions

### MCP Server Architecture (D-23 — research default)
- **D-23:** Tool name is `search_knowledge` — sole MCP tool in v1
- **D-24:** Single `buildMcpServer(searchService)` factory in `apps/mcp-server/src/server.ts`; stdio and HTTP entrypoints call it — transport is the only difference
- **D-25:** **Retrieval-only** — register `search_knowledge` only; no upload, delete, index, ingest, or document CRUD tools (MCP-05)

### Search Tool Contract (D-26 — research default, aligns with D-14/D-16)
- **D-26:** Tool input: `{ query: string, top_k?: number, collection?: string }` — snake_case `top_k` at MCP boundary; map to `SearchService.search(query, { topK, collection })`
- **D-27:** Default `top_k = 5`, hard max `10` — enforced by SearchService (do not bypass)
- **D-28:** Tool output includes per-result: `score`, `text` (snippet, ~500 chars), `documentId`, `filename`, `chunkIndex` (MCP-04); return as JSON in `content[0].text` plus `structuredContent: { results }`

### Transports (D-29 — research default)
- **D-29:** **stdio:** `StdioServerTransport` for Cursor/local spawn; **HTTP:** `StreamableHTTPServerTransport` at `POST /mcp` (NOT legacy SSE-only as primary)
- **D-30:** stdio entrypoint: **zero stdout pollution** — all logging via `console.error` or stderr-only logger; never `console.log` in stdio path
- **D-31:** HTTP entrypoint binds `MCP_HTTP_HOST` (default `127.0.0.1`) and `MCP_HTTP_PORT` (default `3100`) — localhost-friendly dev default (CONF-04 parity)

### Service Wiring (D-32 — research default)
- **D-32:** `createMcpServices()` mirrors backend search subset: `loadConfig()` → `ChromaVectorStore` + `EmbeddingClient` → `SearchService.create()` — no `IngestionService` or registry in MCP app
- **D-33:** Package bin `kb-mcp-server` points to stdio entrypoint for Cursor MCP config

### Claude's Discretion
- Exact MCP tool response formatting (pretty JSON vs compact)
- Stateful vs stateless Streamable HTTP session handling — prefer SDK stateful session map from `simpleStreamableHttp.ts` example
- HTTP framework for `/mcp` route — Express per SDK examples vs Node `http` if compatible
- Startup health probe (Chroma heartbeat) before accepting connections — optional log warning vs hard fail

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — Core value, MCP retrieval-only, dual pipeline
- `.planning/REQUIREMENTS.md` — MCP-01 through MCP-06
- `.planning/ROADMAP.md` — Phase 3 goal and success criteria
- `.planning/phases/02-rest-backend-search/02-CONTEXT.md` — SearchService bounds (D-14, D-16)

### Research
- `.planning/research/SUMMARY.md` — Transport-agnostic MCP factory, stderr-only stdio
- `.planning/research/ARCHITECTURE.md` — Pattern 2: buildServer factory, retrieval flow
- `.planning/research/STACK.md` — `@modelcontextprotocol/sdk@1.29.0`, Streamable HTTP
- `.planning/research/PITFALLS.md` — Stdout pollution, unbounded payloads

### Phase 2 Implementation (reuse, do not reimplement)
- `packages/core/src/search/search-service.ts` — sole retrieval path
- `apps/backend/src/services.ts` — service wiring pattern (search subset only)
- `apps/backend/src/routes/search.ts` — query delegation and bounds

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SearchService.search(query, { topK?, collection? })` — already exported from `@kb/core`
- `SearchService.create(config, { vectorStore, embeddingClient })` — same factory as backend
- `loadConfig()` from `@kb/config` — extend with MCP HTTP vars in Plan 03-03

### Established Patterns
- Apps are thin shells; domain logic stays in `@kb/core`
- Service factories at bootstrap — routes/tools never construct Chroma/embedding clients
- Default topK 5, max 10, snippet 500 chars — already in SearchService

### Integration Points
- New `apps/mcp-server/` workspace package
- Root `pnpm dev` orchestration adds MCP HTTP alongside backend
- Cursor MCP config spawns `kb-mcp-server` bin (stdio)

</code_context>

<deferred>
## Deferred Ideas

- `read_around` / `read_file` MCP tools — v2 RETR-03
- `list_documents` MCP tool — admin surfaces handle corpus view
- OAuth / API key on MCP HTTP — Phase 4 CONF-03
- Legacy SSE-only endpoint for old clients — Streamable HTTP is primary per MCP spec
- Hybrid BM25 + reranking — v2 RETR-01/02

</deferred>

---
*Phase: 3-MCP Search Server*
*Context gathered: 2026-07-01 (research defaults)*
