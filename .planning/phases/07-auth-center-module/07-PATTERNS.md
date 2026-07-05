# Phase 7 Pattern Map

**Phase:** 7 — Auth Center Module  
**Mapped:** 2026-07-05

## PATTERN MAPPING COMPLETE

## Package Scaffold — analog: `packages/config`

| New file | Analog | Pattern to copy |
|----------|--------|-----------------|
| `packages/auth/package.json` | `packages/config/package.json` | `"type": "module"`, exports map, vitest script |
| `packages/auth/tsconfig.json` | `packages/core/tsconfig.json` | extends root, outDir dist |
| `packages/auth/src/index.ts` | `packages/core/src/index.ts` | re-export public API |

## SQLite Store — analog: `packages/core/src/registry/document-registry.ts`

```typescript
// Prepared statements, mapRow helper, interface + factory function
export function getDocumentRegistry(db: Database.Database): DocumentRegistry {
  const upsertStmt = db.prepare(`...`);
  // ...
}
```

Apply same pattern in `packages/auth/src/user-store.ts`:
- `openAuthDatabase(path)` runs `schema.sql`
- `UserStore` with `createUser`, `findByUsername`, `findById`

## Config Env — analog: `packages/config/src/env.ts`

```typescript
AUTH_SQLITE_PATH: z.string().default("./data/sqlite/auth.db"),
// ...
.transform((data) => ({
  ...data,
  AUTH_SQLITE_PATH: resolveRepoRelativePath(data.AUTH_SQLITE_PATH),
}));
```

Add `JWT_SECRET`, `JWT_EXPIRES_IN`, `USER_AUTH_ENABLED` with `superRefine` when enabled.

## Backend Route Registration — analog: `apps/backend/src/routes/documents.ts`

```typescript
export async function registerDocumentRoutes(
  app: FastifyInstance,
  deps: DocumentsDeps,
): Promise<void> {
  const opts = deps.routeOpts ?? {};
  app.post("/api/v1/documents", opts, async (request, reply) => { ... });
}
```

Mirror in `apps/backend/src/routes/auth.ts`:
- `registerAuthRoutes(app, { authProvider, userAuthEnabled })`
- Zod schemas via `fastify-type-provider-zod`

## Error Responses — analog: existing routes

```typescript
return reply.code(400).send({
  error: "bad_request",
  message: "Missing file field",
});
```

Auth routes use same `{ error, message }` keys.

## Test Harness — analog: `apps/backend/src/routes/documents.test.ts`

- Build minimal Fastify app with type provider
- Mock or temp SQLite for auth db
- `app.inject({ method, url, payload, headers })`

## Files Created (Phase 7)

| Path | Role |
|------|------|
| `packages/auth/package.json` | New package |
| `packages/auth/tsconfig.json` | Build config |
| `packages/auth/src/schema.sql` | users table |
| `packages/auth/src/types.ts` | AuthProvider, AuthUser, inputs |
| `packages/auth/src/user-store.ts` | SQLite CRUD |
| `packages/auth/src/local-auth-provider.ts` | bcrypt + JWT |
| `packages/auth/src/jwt.ts` | sign/verify with jose |
| `packages/auth/src/fastify.ts` | createJwtPreHandler (for Phase 8) |
| `packages/auth/src/index.ts` | Public exports |
| `packages/auth/README.md` | AUTH-06 swap documentation |
| `packages/auth/src/local-auth-provider.test.ts` | Unit tests |
| `packages/config/src/env.ts` | JWT + AUTH_SQLITE_PATH |
| `apps/backend/src/routes/auth.ts` | register/login routes |
| `apps/backend/src/routes/auth.test.ts` | Route tests |
| `apps/backend/src/services.ts` | Wire LocalAuthProvider |
| `apps/backend/src/index.ts` | registerAuthRoutes |

---
*Pattern mapping complete*
