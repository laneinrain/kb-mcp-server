# Phase 2: REST Backend & Search - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `@kb/backend` with REST endpoints for document upload (ingest), list, delete, and test semantic search. Introduce `SearchService` in `@kb/core` as the **single retrieval path** shared by REST (Phase 2) and MCP (Phase 3). Reuse Phase 1 `IngestionService`, `DocumentRegistry`, `ChromaVectorStore`, and `EmbeddingClient` — no duplicate Chroma/embedding logic in routes.

**In scope:** API-01–API-04, `SearchService`, Fastify routes, multipart upload, OpenAPI docs, Zod request/response validation.

**Out of scope:** MCP transport (Phase 3), Web admin UI (Phase 4), CLI (Phase 4), optional API key auth (Phase 4 / CONF-03), async job queue for ingest, pagination beyond simple list, collection management UI.

</domain>

<decisions>
## Implementation Decisions

### Document Upload (D-08 — research default)
- **D-08:** `POST /documents` accepts **multipart file upload** (`@fastify/multipart`); fields: single file + optional `collection` (defaults to `DEFAULT_COLLECTION`)
- **D-09:** Allowed MIME/extensions match Phase 1 parsers: `.txt`, `.md`, `.markdown`, `.pdf`
- **D-10:** Upload writes to a temp file under `DATA_DIR/uploads/` then calls existing `IngestionService.ingest()` — same pipeline as `pnpm ingest`

### Ingest Response Semantics (D-11 — research default)
- **D-11:** **Synchronous ingest** — HTTP request blocks until ingest completes or fails; response `201` with `{ documentId, chunkCount, collection, status: "indexed" }`
- **D-12:** Failures return `4xx/5xx` with clear JSON `{ error, message }` (e.g. scanned PDF rejection propagates from parser)

### Search API (D-13 — research default)
- **D-13:** `POST /search` with JSON body `{ query: string, topK?: number, collection?: string }`
- **D-14:** Default `topK = 5`, hard max `10` (aligns with MCP bounds in Phase 3)
- **D-15:** `SearchService.search()` uses `EmbeddingClient.embedQuery()` (Qwen3 retrieval prefix) → Chroma query → ranked results
- **D-16:** Each result includes: `score`, `text` (snippet, truncated ~500 chars), `documentId`, `filename`, `chunkIndex`

### Document List & Delete (D-17 — research default)
- **D-17:** `GET /documents` returns **full list** (no pagination v1 — local KB scale); fields: `id`, `filename`, `status`, `chunkCount`, `collection`, `createdAt`, `updatedAt` (omit internal `sourcePath` from API response unless needed for debug)
- **D-18:** `DELETE /documents/:documentId` removes registry row + Chroma vectors via existing `ChromaVectorStore.deleteByDocumentId()`; `404` if unknown id
- **D-19:** No batch delete in v1

### API Surface & Docs (D-20 — research default)
- **D-20:** Routes prefixed under `/api/v1/` (e.g. `/api/v1/documents`, `/api/v1/search`); health routes stay at `/health*` (Phase 1 compatibility)
- **D-21:** OpenAPI via `@fastify/swagger` + `@fastify/swagger-ui` at `/docs` (dev discoverability)
- **D-22:** Request/response validation via `fastify-type-provider-zod` + Zod schemas in route modules

### Claude's Discretion (user selected option 7 — "you decide")
- Exact snippet truncation length and score normalization (distance → similarity)
- Temp upload cleanup policy (delete after successful ingest vs retain for debug)
- Whether `GET /documents/:id` detail endpoint is needed for v1 (add if trivial via registry)
- Chroma query API details (`collection.query` vs get+filter) — follow chromadb 3.4 patterns from Phase 1
- Error mapping from core exceptions to HTTP status codes

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — Core value, MCP retrieval-only, dual pipeline
- `.planning/REQUIREMENTS.md` — API-01 through API-04
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria
- `.planning/phases/01-platform-foundation-ingestion/01-CONTEXT.md` — Chunking, registry, ingest decisions

### Research
- `.planning/research/SUMMARY.md` — SearchService shared path, REST before MCP
- `.planning/research/ARCHITECTURE.md` — SearchService design, REST ↔ core wiring
- `.planning/research/STACK.md` — Fastify 5, multipart, swagger, zod type provider
- `.planning/research/PITFALLS.md` — Query/index embedding parity, bounded top_k

### Phase 1 Implementation (reuse, do not reimplement)
- `packages/core/src/ingestion/ingestion-service.ts` — ingest orchestration
- `packages/core/src/registry/document-registry.ts` — list/get/delete metadata
- `packages/core/src/embeddings/embedding-client.ts` — embedQuery with retrieval prefix
- `packages/core/src/vector-store/chroma-store.ts` — vector upsert/delete
- `apps/backend/src/routes/health.ts` — existing health pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `IngestionService` — wire REST upload → temp file → `ingest(path, { collection })`
- `DocumentRegistry.listDocuments()` / `deleteDocument()` — list and delete metadata
- `ChromaVectorStore.deleteByDocumentId()` — vector cleanup on delete
- `EmbeddingClient.embedQuery()` — query embedding with Qwen3 instruct prefix
- Health route registration pattern in `apps/backend/src/index.ts`

### Established Patterns
- All config via `loadConfig()` from `@kb/config`
- `@kb/core` exports domain logic; apps are thin Fastify shells
- Document id = sha256(normalized absolute path) — REST uploads get new temp paths → new ids per upload (re-upload same filename = new document unless dedup added later)

### Integration Points
- New `packages/core/src/search/search-service.ts` (or similar) exported from `@kb/core`
- New `apps/backend/src/routes/documents.ts` and `search.ts`
- Register multipart + swagger plugins in backend bootstrap

</code_context>

<specifics>
## Specific Ideas

- User chose **option 7 (you decide)** — research defaults applied without interactive deep-dive
- Phase 2 success criterion #4: REST search **must** call the same `SearchService` MCP will use in Phase 3

</specifics>

<deferred>
## Deferred Ideas

- Async ingest with job status polling (202 Accepted) — defer to v1.x if sync ingest too slow
- Pagination / filtering on document list — defer until corpus size warrants
- Batch delete — Phase 4 admin convenience
- API key auth (`@fastify/bearer-auth`) — Phase 4 CONF-03
- `GET /` root route or landing page — not required; `/docs` for API discovery

</deferred>

---
*Phase: 2-REST Backend & Search*
*Context gathered: 2026-07-01*
