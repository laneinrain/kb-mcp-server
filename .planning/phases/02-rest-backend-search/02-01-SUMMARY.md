---
phase: 02-rest-backend-search
plan: 01
subsystem: core
tags: [search, chromadb, embeddings, vitest]

requires: [01-03]
provides:
  - ChromaVectorStore.query() for ANN retrieval with pre-computed embeddings
  - SearchService as sole shared retrieval path (embedQuery → query → format)
  - SearchOptions/SearchResult types exported from @kb/core
affects: [02-02, 02-03, phase-3-mcp]

tech-stack:
  added: []
  patterns: [queryEmbeddings only (no queryTexts), score = clamp(1-distance), 500-char snippets]

key-files:
  created:
    - packages/core/src/search/search-service.ts
    - packages/core/src/search/types.ts
    - packages/core/src/search/search-service.test.ts
  modified:
    - packages/core/src/vector-store/chroma-store.ts
    - packages/core/src/vector-store/chroma-store.test.ts
    - packages/core/src/index.ts

key-decisions:
  - "Query metadata maps document_id/filename/chunk_index from upsert contract"
  - "topK default 5, hard max 10; score rounded to 4 decimals"

requirements-completed: [API-04]

duration: 15min
completed: 2026-06-29
---

# Phase 2 Plan 01: SearchService Summary

**ChromaVectorStore.query() and SearchService — shared semantic retrieval for REST and future MCP**

## Accomplishments

- Added `ChromaVectorStore.query()` using `queryEmbeddings` with documents/metadatas/distances
- Implemented `SearchService.search()` pipeline: embedQuery → vectorStore.query → score/snippet formatting
- Exported SearchService, SearchOptions, SearchResult, QueryParams, QueryHit from `@kb/core`
- 12 unit tests passing (chroma-store + search-service)

## Verification

- `pnpm --filter @kb/core test` — 33 tests pass
- `pnpm --filter @kb/core build` — success
