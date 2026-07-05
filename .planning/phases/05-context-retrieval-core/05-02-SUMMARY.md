---
phase: 05-context-retrieval-core
plan: 02
subsystem: api
tags: [context-service, chroma, vitest, bounds, truncation]

requires:
  - phase: 05-01
    provides: ChromaVectorStore.getByIds, SettingsStore.getContextConfig
provides:
  - ContextService readAround/readFile orchestration
  - ContextError structured codes (document_not_found, chunk_index_out_of_range, chunks_missing)
  - truncateAroundCenter and truncateFromEnd algorithms
affects:
  - 05-03 (backend wiring, settings API)
  - 06-01 (MCP read_around/read_file tools)

tech-stack:
  added: []
  patterns:
    - "Registry validate → slice chromaIds → getByIds → sort → truncate"
    - "Live getContextConfig() on every readAround/readFile call (D-13)"
    - "ContextService.create factory mirroring SearchService"

key-files:
  created:
    - packages/core/src/context/context-service.ts
    - packages/core/src/context/context-service.test.ts
    - packages/core/src/context/types.ts
    - packages/core/src/context/errors.ts
  modified:
    - packages/core/src/index.ts

key-decisions:
  - "Collection resolves options?.collection ?? doc.collection ?? defaultCollection (intentional divergence from SearchService)"
  - "getByIds returning fewer hits than expected slice throws chunks_missing ContextError (REVIEWS.md)"

patterns-established:
  - "Fail-fast validation before Chroma fetch — no partial chunks on bad doc/index"
  - "Symmetric window clamp/shrink with windowRequested/windowApplied metadata"

requirements-completed: [CORE-01, CORE-02]

duration: 8min
completed: 2026-07-05
---

# Phase 5 Plan 02: ContextService readAround/readFile Summary

**Bounded context retrieval service with symmetric readAround windows, readFile chunk/char caps, and structured ContextError before any Chroma fetch**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-05T06:51:00Z
- **Completed:** 2026-07-05T06:59:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `ContextService` with `readAround` and `readFile` using registry validation → sliced `getByIds` → sort → truncate pipeline
- `ContextError` codes: `document_not_found`, `chunk_index_out_of_range`, `chunks_missing` (Chroma/registry drift)
- `truncateAroundCenter` (D-08) and `truncateFromEnd` algorithms with exported helpers for testing
- 20 unit tests covering D-01–D-08, D-13, CORE-02, and missing-chunk error path

## Task Commits

1. **Task 1+2: Context types, ContextError, ContextService, unit tests** — `a0991d7` (feat)

**Plan metadata:** pending (docs commit)

## Files Created/Modified

- `packages/core/src/context/context-service.ts` — readAround/readFile orchestration
- `packages/core/src/context/context-service.test.ts` — comprehensive mocked unit tests
- `packages/core/src/context/types.ts` — ReadAroundResult, ReadFileResult, ContextChunk
- `packages/core/src/context/errors.ts` — ContextError class and codes
- `packages/core/src/index.ts` — exports ContextService, types, errors

## Decisions Made

- Added `chunks_missing` error code per REVIEWS.md when `getByIds` returns fewer hits than the requested slice — extends CORE-02 no-partial-chunks policy
- Collection resolution prefers document's stored collection over default (differs from SearchService which ignores `doc.collection`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] chunks_missing error on partial Chroma response**
- **Found during:** Task 2 (ContextService implementation)
- **Issue:** Plan specified only two error codes; REVIEWS.md flagged silent partial windows as HIGH risk
- **Fix:** Added `chunks_missing` to ContextErrorCode; throw when `hits.length < idsToFetch.length`
- **Files modified:** packages/core/src/context/errors.ts, context-service.ts, context-service.test.ts
- **Committed in:** a0991d7

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Required for correctness per adversarial review; no scope creep.

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness

- ContextService exported from `@kb/core` and ready for backend wiring in 05-03
- Error codes stable for Phase 6 MCP JSON mapping
- Phase 6 should note center-only exceeding char cap may still exceed MCP client limits (REVIEW LOW item)

## Self-Check: PASSED

- FOUND: packages/core/src/context/context-service.ts
- FOUND: packages/core/src/context/context-service.test.ts
- FOUND: packages/core/src/context/types.ts
- FOUND: packages/core/src/context/errors.ts
- FOUND: commit a0991d7

---
*Phase: 05-context-retrieval-core*
*Completed: 2026-07-05*
