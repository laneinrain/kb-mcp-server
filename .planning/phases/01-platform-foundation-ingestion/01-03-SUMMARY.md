---
phase: 01-platform-foundation-ingestion
plan: 03
subsystem: ingestion
tags: [fastify, chroma, pdf-parse, gray-matter, cherryin, vitest]

requires:
  - phase: 01-02
    provides: ChromaVectorStore, EmbeddingClient, DocumentRegistry, chunker
provides:
  - txt/md/pdf parsers with scanned-PDF rejection
  - IngestionService delete-then-upsert pipeline
  - Health-only Fastify backend on 127.0.0.1
  - pnpm dev orchestration and pnpm ingest CLI
affects: [02-rest-crud, 03-mcp-retrieval]

tech-stack:
  added: [gray-matter, pdf-parse, fastify, concurrently]
  patterns: [delete-before-upsert re-ingest, path allowlist under cwd, embed-all-before-chroma-write]

key-files:
  created:
    - packages/core/src/ingestion/parsers/
    - packages/core/src/ingestion/ingestion-service.ts
    - apps/backend/src/routes/health.ts
    - scripts/ingest.ts
    - scripts/fixtures/sample.txt
    - scripts/fixtures/sample.md
  modified:
    - packages/core/src/index.ts
    - packages/core/src/vector-store/chroma-store.ts
    - package.json

key-decisions:
  - "document_id = sha256(normalized absolute path) for stable re-ingest replacement"
  - "Registry status flow pending → processing → indexed (not 'complete')"
  - "ChromaVectorStore.heartbeat() exposed for /health/chroma"

patterns-established:
  - "parseDocument allowlist: .txt, .md, .markdown, .pdf only"
  - "PDF rejection threshold max(50, ceil(pageCount * 0.1))"

requirements-completed: [INGE-01, INGE-02, INGE-03, INGE-04, INGE-05, INGE-06, INGE-07, INGE-08, INGE-09, API-05, CONF-04]

duration: 25min
completed: 2026-06-29
checkpoint_status: approved_task_4
---

# Phase 1 Plan 03: Ingestion Pipeline Summary

**Full parse→chunk→embed→store pipeline with txt/md/pdf parsers, re-ingest delete-then-upsert, health backend on localhost, and pnpm dev orchestration — awaiting live E2E verification**

## Checkpoint Status

**Task 4 (human-verify) is PENDING.** Tasks 1–3 complete and committed. Operator must run live stack verification before requirements are marked complete.

## Performance

- **Duration:** ~25 min
- **Tasks completed:** 3/4 (checkpoint blocked)
- **Files modified:** 20+

## Accomplishments

- Document parsers for txt, md (gray-matter), pdf (pdf-parse with 50MB cap and scanned-PDF rejection)
- IngestionService orchestrating parse → chunk → embed → upsert with delete-before-upsert re-ingest
- `@kb/backend` health API: `/health`, `/health/chroma`, `/health/embeddings`
- `pnpm dev` starts Chroma sidecar + backend; `pnpm ingest <file>` CLI wired

## Task Commits

1. **Task 1: Document parsers** — `e59940e` (test), `eeb23ef` (feat)
2. **Task 2: IngestionService** — `9524fda` (test), `cb04ffe` (feat)
3. **Task 3: Health backend + CLI + dev** — `0f0d38f` (feat)

## Test Results

```
pnpm --filter @kb/core test
→ 9 test files, 22 passed, 1 skipped

pnpm exec tsc -p apps/backend/tsconfig.json --noEmit
→ pass
```

Parser tests include `txt-parser.test.ts` and `md-parser.test.ts` per plan.

## How to Run

### Start dev stack

```bash
pnpm dev
```

Starts Chroma at `./data/chroma` and backend at `http://127.0.0.1:3000` (requires `.env` with `CHERRYIN_API_KEY`).

### Ingest a document

```bash
pnpm ingest scripts/fixtures/sample.txt
pnpm ingest scripts/fixtures/sample.md
pnpm ingest scripts/fixtures/sample.txt --collection research
```

Success prints JSON: `{ documentId, chunkCount, collection }`.

## Task 4 Verification Steps (Human)

1. Ensure `.env` has real `CHERRYIN_API_KEY` (user confirmed configured)
2. Run `pnpm dev` — wait for Chroma + backend ready
3. `curl http://127.0.0.1:3000/health` → `{ "status": "ok" }`
4. `curl http://127.0.0.1:3000/health/chroma` → `{ "status": "ok" }`
5. `curl http://127.0.0.1:3000/health/embeddings` → `{ "status": "ok", "model": "qwen/qwen3-embedding-8b" }`
6. `pnpm ingest scripts/fixtures/sample.txt` → `chunkCount > 0`
7. Re-run same ingest → succeeds (replaces vectors, no duplicate error)
8. Stop `pnpm dev`, restart — vectors from step 6 still present (INGE-07)
9. Optional: ingest scanned PDF → clear rejection error (INGE-04)

**Resume signal:** Type "approved" or describe issues.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript build fixes for pdf-parse and test mocks**
- **Found during:** Task 1–2 verification
- **Issue:** Missing pdf-parse types; ingestion-service test mock typing failed tsc
- **Fix:** Added `src/types/pdf-parse.d.ts`; simplified registry mock casts
- **Files modified:** packages/core/src/types/pdf-parse.d.ts, ingestion-service.test.ts
- **Committed in:** eeb23ef, cb04ffe

**2. [Rule 2 - Missing Critical] ChromaVectorStore.heartbeat() for health route**
- **Found during:** Task 3
- **Issue:** Health route needs explicit heartbeat on vector store
- **Fix:** Added `heartbeat()` delegating to client
- **Committed in:** cb04ffe

## Self-Check: PASSED

- FOUND: packages/core/src/ingestion/ingestion-service.ts
- FOUND: scripts/ingest.ts
- FOUND: apps/backend/src/routes/health.ts
- FOUND: e59940e, eeb23ef, 9524fda, cb04ffe, 0f0d38f

---
*Phase: 01-platform-foundation-ingestion*
*Checkpoint pending: Task 4 human-verify*
