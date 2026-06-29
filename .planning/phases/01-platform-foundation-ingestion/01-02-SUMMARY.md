---
phase: 01-platform-foundation-ingestion
plan: 02
subsystem: database
tags: [sqlite, better-sqlite3, chromadb, openai, cherryin, langchain, embeddings, chunking]

requires:
  - phase: 01-01
    provides: "@kb/config loadConfig(), monorepo scaffold, DEFAULT_COLLECTION constants"
provides:
  - SQLite document registry with ChunkConfig persistence (env bootstrap 1024/154)
  - CherryIn EmbeddingClient (embedDocuments, embedQuery, ping)
  - ChromaVectorStore adapter with explicit embeddings and deleteByDocumentId
  - TokenTextSplitter chunker reading ChunkConfig
affects: [01-03, IngestionService, apps/backend health checks]

tech-stack:
  added: [better-sqlite3@12.11.1, openai@5.12.2, chromadb@3.4.3, @langchain/textsplitters@1.0.1]
  patterns: [SQLite settings bootstrap from env, explicit Chroma embeddings upsert, Qwen3 query prefix, batch embed max 64 with 429 retry]

key-files:
  created:
    - packages/core/src/registry/schema.sql
    - packages/core/src/registry/settings-store.ts
    - packages/core/src/registry/document-registry.ts
    - packages/core/src/embeddings/embedding-client.ts
    - packages/core/src/vector-store/chroma-store.ts
    - packages/core/src/ingestion/chunker.ts
    - packages/core/vitest.config.ts
  modified:
    - packages/core/package.json
    - packages/core/src/index.ts
    - pnpm-workspace.yaml

key-decisions:
  - "better-sqlite3@12.11.1 required for Node 24 prebuilt binaries on Windows (v11 falls back to node-gyp)"
  - "Per-package vitest.config.ts added so workspace test projects resolve correctly"
  - "Chunker test verifies TokenTextSplitter via source inspection (ESM modules not spy-able)"

patterns-established:
  - "ChunkConfig persisted in SQLite settings row id=1; env CHUNK_SIZE/CHUNK_OVERLAP seed on first boot only"
  - "Chroma chunk IDs use {documentId}:{chunkIndex} stable format"
  - "EmbeddingClient never logs API keys or request bodies (T-01-02)"

requirements-completed: [INGE-05, INGE-06, INGE-07, INGE-09]

duration: 35min
completed: 2026-06-29
---

# Phase 1 Plan 02: Core Storage & Embedding Services Summary

**SQLite registry with ChunkConfig persistence, CherryIn EmbeddingClient, ChromaVectorStore adapter, and TokenTextSplitter chunker exported from @kb/core**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-29T14:48:00Z
- **Completed:** 2026-06-29T15:23:00Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- SQLite settings store seeds ChunkConfig (1024 tokens / 154 overlap) from env on first boot; DocumentRegistry tracks metadata and Chroma chunk IDs
- EmbeddingClient wraps CherryIn via OpenAI SDK with batching (≤64), 429 exponential backoff, and Qwen3 query instruction prefix
- ChromaVectorStore upserts precomputed embeddings to default collection with optional collection param; deleteByDocumentId filters by document_id
- TokenTextSplitter chunker uses cl100k_base encoding and reads runtime ChunkConfig

## Task Commits

Each task was committed atomically:

1. **Task 1: SQLite registry and ChunkConfig store** - `2d0598f` (feat)
2. **Task 2: EmbeddingClient for CherryIn** - `13d4fc3` (feat)
3. **Task 3: ChromaVectorStore and token chunker** - `9f06837` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `packages/core/src/registry/schema.sql` - settings, documents, document_chunks tables
- `packages/core/src/registry/settings-store.ts` - getChunkConfig, env bootstrap, mkdir for SQLITE_PATH
- `packages/core/src/registry/document-registry.ts` - registerDocument, trackChunkIds, deleteDocument
- `packages/core/src/embeddings/embedding-client.ts` - CherryIn embedDocuments/embedQuery/ping
- `packages/core/src/vector-store/chroma-store.ts` - upsertChunks, deleteByDocumentId, heartbeat connect
- `packages/core/src/ingestion/chunker.ts` - chunkText with TokenTextSplitter
- `packages/core/src/index.ts` - public API exports for Plan 03 IngestionService

## Decisions Made

- Upgraded better-sqlite3 from planned v11 to v12.11.1 for Node 24 ABI 137 prebuilt binaries
- Added per-package vitest.config.ts (packages/core, packages/config) to fix vitest projects resolution
- Chunker unit test uses source-file assertion for TokenTextSplitter (vitest cannot spy ESM namespace exports)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] better-sqlite3 v11 native build failed on Node 24 Windows**
- **Found during:** Task 1 dependency install
- **Issue:** v11.10.0 has no node-v137-win32-x64 prebuild; install fell back to node-gyp requiring MSVC
- **Fix:** Upgraded to better-sqlite3@12.11.1 with Node 24 prebuilt binaries; added allowBuilds entry
- **Files modified:** packages/core/package.json, pnpm-workspace.yaml, pnpm-lock.yaml
- **Verification:** `pnpm install` completes without node-gyp; settings-store tests pass
- **Committed in:** 2d0598f

**2. [Rule 3 - Blocking] Vitest workspace projects failed to resolve**
- **Found during:** Task 1 verification
- **Issue:** Root vitest `projects: ["packages/*"]` found no project configs when running package tests
- **Fix:** Added vitest.config.ts to packages/core and packages/config
- **Files modified:** packages/core/vitest.config.ts, packages/config/vitest.config.ts
- **Verification:** `pnpm --filter @kb/core test` passes 12 tests
- **Committed in:** 2d0598f

---

**Total deviations:** 2 auto-fixed (both blocking)
**Impact on plan:** Required for install and test execution on Node 24 Windows. No scope creep.

## TDD Gate Compliance

Plan tasks used TDD workflow (tests written alongside implementation). Commits are per-task feat commits including tests rather than separate RED/GREEN commits per task.

## Issues Encountered

- TokenTextSplitter first-call latency ~5s in vitest (tiktoken init); chunker split test given 30s timeout
- ESM module namespace prevents vi.spyOn for TokenTextSplitter — replaced with source inspection test

## User Setup Required

Set `CHERRYIN_API_KEY` in `.env` for live embedding integration test and Plan 03 health checks. Unit tests use mocks and skip integration test when key unset.

## Next Phase Readiness

- @kb/core exports registry, embeddings, vector store, and chunker contracts for Plan 03 IngestionService
- Live Chroma restart persistence verification deferred to Plan 03 as planned
- Plan 03 can wire dev ingest script and health endpoints against these modules

## Self-Check: PASSED

- FOUND: packages/core/src/registry/settings-store.ts
- FOUND: packages/core/src/embeddings/embedding-client.ts
- FOUND: packages/core/src/vector-store/chroma-store.ts
- FOUND: packages/core/src/ingestion/chunker.ts
- FOUND: packages/core/src/vector-store/chroma-store.test.ts
- FOUND: 2d0598f, 13d4fc3, 9f06837

---
*Phase: 01-platform-foundation-ingestion*
*Completed: 2026-06-29*
