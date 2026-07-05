# Phase 7 Research: Auth Center Module

**Researched:** 2026-07-05  
**Phase:** 7 — Auth Center Module  
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-06

## RESEARCH COMPLETE

## Executive Summary

Phase 7 introduces a **new workspace package `@kb/auth`** — independent of `@kb/core` document registry — with a swappable `AuthProvider` interface and a default `LocalAuthProvider` backed by SQLite + bcrypt password hashing + JWT (via `jose`). The backend mounts **public** `/api/v1/auth/register` and `/api/v1/auth/login` routes that delegate to `@kb/auth`; document/search route protection with user JWT is **Phase 8** (AUTH-04/05).

Existing `@fastify/bearer-auth` + shared `API_KEY` (Phase 4) remains untouched in Phase 7 so CLI/service flows keep working until Phase 8 wires user JWT on `/api/v1/documents` and `/api/v1/search`.

## Technical Decisions

| Topic | Choice | Rationale |
|-------|--------|-----------|
| Package location | `packages/auth` → `@kb/auth` | Matches `@kb/config`, `@kb/core` monorepo pattern; swappable without touching ingestion |
| User DB | Separate SQLite file `AUTH_SQLITE_PATH` (default `./data/sqlite/auth.db`) | Auth center owns schema; production can point to external store via custom `AuthProvider` |
| Password hash | `bcryptjs` (cost 12) | Pure JS, no extra native addon beyond existing `better-sqlite3`; satisfies AUTH-02 |
| JWT library | `jose` | Lightweight, ESM-native, no Fastify coupling — keeps `@kb/auth` framework-agnostic |
| Token payload | `{ sub: userId, username }` + `exp` | Minimal claims; Phase 8 reads `sub` as `user_id` |
| Auth routes | `POST /api/v1/auth/register`, `POST /api/v1/auth/login` | RESTful, versioned, distinct from document CRUD |
| Route auth in Phase 7 | Auth routes **public**; document routes still use optional `API_KEY` bearer | Scope boundary — AUTH-04 is Phase 8 |
| Username | Unique `username` (3–32 chars, alphanumeric + `_`) + optional `email` | Simple local auth; email not verified in v1.2 |
| Error shape | Match backend: `{ error: string, message: string }` | Consistency with existing Fastify error handler |

## AuthProvider Contract (AUTH-01)

```typescript
export interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  createdAt: string;
}

export interface RegisterInput {
  username: string;
  password: string;
  email?: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number; // seconds
}

export interface AuthProvider {
  register(input: RegisterInput): Promise<AuthUser>;
  login(input: LoginInput): Promise<{ user: AuthUser; tokens: AuthTokens }>;
  validateAccessToken(token: string): Promise<AuthUser>;
  getUserById(id: string): Promise<AuthUser | null>;
}
```

Production swap: implement `AuthProvider` delegating to OAuth/OIDC/LDAP; backend keeps calling the same interface via factory in `@kb/auth`.

## SQLite Schema (AUTH-02)

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
```

## Config Additions (Phase 7)

Add to `@kb/config` (not replacing `API_KEY`):

| Env var | Default | Notes |
|---------|---------|-------|
| `JWT_SECRET` | — | Required when `USER_AUTH_ENABLED=true` (new flag) |
| `JWT_EXPIRES_IN` | `604800` (7 days, seconds) | Access token TTL |
| `AUTH_SQLITE_PATH` | `./data/sqlite/auth.db` | Resolved via monorepo root like `SQLITE_PATH` |
| `USER_AUTH_ENABLED` | `false` | Gates auth route registration + JWT config validation |

When `USER_AUTH_ENABLED=false`, backend skips auth routes (dev convenience). When `true`, `JWT_SECRET` required.

## Fastify Integration Pattern

```typescript
// packages/auth/src/fastify.ts
export function createJwtPreHandler(provider: AuthProvider) {
  return async (request, reply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "unauthorized", message: "Missing Bearer token" });
    }
    try {
      const user = await provider.validateAccessToken(header.slice(7));
      request.user = user;
    } catch {
      return reply.code(401).send({ error: "unauthorized", message: "Invalid or expired token" });
    }
  };
}
```

Phase 7 exports this factory; Phase 8 applies it to document/search routes.

## Security Notes

- Never log passwords or JWT secrets
- Register endpoint: rate-limit deferred (document in README as production hardening)
- Duplicate username → 409 `{ error: "conflict", message: "Username already exists" }`
- Invalid login → 401 `{ error: "unauthorized", message: "Invalid username or password" }` (no user enumeration via same message)

## Dependencies

**New `@kb/auth` dependencies:**
- `better-sqlite3` (same as `@kb/core`)
- `bcryptjs` + `@types/bcryptjs`
- `jose`
- `@kb/config` (path resolution only)

**Backend adds:**
- `@kb/auth` workspace dependency

## Testing Strategy

| Layer | Tests |
|-------|-------|
| `@kb/auth` unit | register, duplicate user, login success/fail, validate token, expired token |
| Backend integration | POST register → 201 + token; POST login → 200 + token; invalid body → 400 |

## Phase Boundary

**In scope (Phase 7):** AUTH-01, AUTH-02, AUTH-03, AUTH-06  
**Out of scope (Phase 8+):** AUTH-04, AUTH-05, USER-*, WEB-*, document `user_id`, replacing ApiKeyModal

## References

- `apps/backend/src/auth.ts` — existing API_KEY bearer pattern
- `packages/core/src/registry/document-registry.ts` — better-sqlite3 prepared statement pattern
- `packages/config/src/env.ts` — Zod env + monorepo path resolution

---
*Research complete — ready for planning*
