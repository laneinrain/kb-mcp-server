# Phase 8 Pattern Map

**Phase:** 08-multi-user-backend-web-auth  
**Generated:** 2026-07-05

## Analog Files

| New / modified role | Closest analog | Pattern to copy |
|--------------------|----------------|-----------------|
| Composite route auth | `apps/backend/src/auth.ts` | `apiRouteOpts` + `registerBearerAuthIfEnabled` with `addHook: false` |
| JWT preHandler | `packages/auth/src/fastify.ts` | `createJwtPreHandler` → extend to set `authUser` |
| Route registration order | `apps/backend/src/index.ts` | auth routes public → bearer register → routeOpts on /api/v1 |
| SQLite prepared statements | `packages/core/src/registry/document-registry.ts` | Parameterized queries, `mapRow` |
| Auth user store | `packages/auth/src/user-store.ts` | `openAuthDatabase`, schema.sql on open |
| Web token client | `apps/web/src/lib/auth-token.ts` + `api/client.ts` | localStorage JWT, Bearer header |
| Login gate | `apps/web/src/main.tsx` | pathname check + redirect |
| Backend auth tests | `apps/backend/src/routes/auth.test.ts` | inject app with mock provider |
| Document route tests | `apps/backend/src/routes/documents.test.ts` | `buildApp` helper pattern |

## Integration Points

1. **`createAppServices`** — expose `systemUserId` after `ensureSystemUser()` on auth DB open.
2. **`registerDocumentRoutes`** — read `request.authUser` / `request.authMode` from extended Fastify request type.
3. **`IngestionService.ingest`** — pass `userId` into registry + chroma metadata.
4. **`SearchService.search`** — filter results to visible doc IDs for JWT users.

## Constants (locked for implementation)

```typescript
export const SYSTEM_EMPLOYEE_ID = "00000000";
export const SYSTEM_AUTH_SOURCE = "system";
```
