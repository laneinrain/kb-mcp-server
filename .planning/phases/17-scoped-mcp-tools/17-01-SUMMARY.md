# Phase 17 Plan 01 Summary: ContextService ACL

**Completed:** 2026-07-17  
**Status:** Done

## Delivered

- `allowedDocumentIds` on `ReadAroundOptions` / `ReadFileOptions`
- `assertDocumentAllowed` → `document_not_found` when outside set
- Unit tests: allow, deny (no getByIds), omit = global

## Tests

`pnpm --filter @kb/core test -- context-service` — pass
