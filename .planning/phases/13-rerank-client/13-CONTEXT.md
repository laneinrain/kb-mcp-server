# Phase 13: Rerank Client - Context

**Gathered:** 2026-07-16  
**Status:** Ready for planning

<domain>
## Phase Boundary

Add **`RerankClient`** in `@kb/core` that calls CherryIn rerank API with model **`qwen/qwen3-reranker-0.6b`** (free tier). Reuses existing **`CHERRYIN_API_KEY`** and **`CHERRYIN_BASE_URL`**.

**In scope:** RETR-02, RETR-03, RETR-04, RETR-05

**Out of scope (Phase 14+):** `SearchService` integration, env `RERANK_ENABLED` / `RERANK_CANDIDATES`, REST/MCP wiring, README

**Unchanged:** `EmbeddingClient`, `SearchService`, Chroma query, ingestion pipeline
</domain>

<decisions>
## Implementation Decisions

### API Endpoint
- **D-01:** POST `{CHERRYIN_BASE_URL}/rerank` — `CHERRYIN_BASE_URL` already normalized to end with `/v1` (e.g. `https://open.cherryin.cc/v1`)
- **D-02:** Request body Cohere/Jina shape: `{ model, query, documents, top_n? }`
- **D-03:** Response shape: `{ results: [{ index, relevance_score }] }` sorted best-first by provider
- **D-04:** If CherryIn returns alternate shape during live test, adapt parser in `RerankClient` only (no SearchService changes in Phase 13)

### Model & Auth
- **D-05:** Model constant `RERANK_MODEL = "qwen/qwen3-reranker-0.6b"` in `packages/config/src/constants.ts`
- **D-06:** Auth header `Authorization: Bearer ${CHERRYIN_API_KEY}` — same as OpenAI SDK used by `EmbeddingClient`
- **D-07:** No new env vars in Phase 13; `RERANK_ENABLED` deferred to Phase 15

### Client Design
- **D-08:** New module `packages/core/src/rerank/rerank-client.ts` — use native **`fetch`**, not OpenAI SDK (no standard rerank method)
- **D-09:** Public method `rerank(query, documents, options?)` returns `RerankResult[]` with `{ index, relevanceScore }` mapped from API
- **D-10:** `rerank([], ...)` or `documents.length === 0` returns `[]` without API call
- **D-11:** `topN` optional; when set, pass as `top_n` in request body; when omitted, provider returns all scored

### Retry & Errors
- **D-12:** 429 rate-limit retry: 3 attempts, exponential backoff `2^attempt * 250ms` — mirror `EmbeddingClient`
- **D-13:** Non-429 errors throw `RerankError` with status + message (new error class in `rerank/errors.ts`)
- **D-14:** `ping()` calls rerank with single dummy document for health checks (optional export)

### Types & Exports
- **D-15:** `RerankResult`: `{ index: number; relevanceScore: number }`
- **D-16:** `RerankOptions`: `{ topN?: number; model?: string }` — model override for tests
- **D-17:** Export `RerankClient`, `RerankResult`, `RerankError` from `packages/core/src/index.ts`

### Claude's Discretion
- Injectable `fetch` for unit tests (default `globalThis.fetch`)
- Clamp `relevanceScore` to finite number; default 0 if missing
- Sort results by `relevanceScore` desc before return (defensive if API returns unsorted)
</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — RETR-02–05
- `.planning/milestones/v1.4-ROADMAP.md` — Phase 13 plans
- `packages/core/src/embeddings/embedding-client.ts` — retry pattern, CherryIn config usage
- `packages/config/src/constants.ts` — `EMBEDDING_MODEL` pattern
- `packages/config/src/env.ts` — `CHERRYIN_BASE_URL` transform
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EmbeddingClient` — CherryIn credentials, 429 retry, batch pattern
- `AppConfig` — `CHERRYIN_API_KEY`, `CHERRYIN_BASE_URL` already validated
- `makeConfig()` test helper pattern in `embedding-client.test.ts`

### Integration Points (Phase 14, not this phase)
- `SearchService` will inject `RerankClient` and call after Chroma recall
- `apps/backend/src/services.ts` — service factory wiring
- `apps/mcp-server` — shared SearchService instance

</code_context>
