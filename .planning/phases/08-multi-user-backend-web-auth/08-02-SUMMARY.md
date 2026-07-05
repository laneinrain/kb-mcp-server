# 08-02 Summary

**Status:** Complete  
**Plan:** Composite JWT/API_KEY auth + scoped document/search routes

## Delivered

- `createProtectedRouteOpts()` — JWT user mode or global `API_KEY` service mode when `USER_AUTH_ENABLED`
- `createAppServices()` wires `ensureSystemUser()`, registry migration, exposes `systemUserId`
- Document routes: user-scoped list/get/delete/upload; cross-user returns 404
- Search routes: JWT filters hits to visible document IDs via `allowedDocumentIds`
- `.env.example` documents CLI + USER_AUTH flag combination
- Integration tests: `documents.multi-user.test.ts`, `search.multi-user.test.ts`

## Verification

- `pnpm --filter @kb/core build && pnpm --filter @kb/backend test` — 33/33 pass
