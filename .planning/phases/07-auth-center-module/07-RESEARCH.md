# Phase 7 Research: Auth Center Module

**Researched:** 2026-07-05  
**Revised:** 2026-07-05 (supersedes username/local-login draft — see `07-CONTEXT.md`)

## RESEARCH COMPLETE

## Executive Summary

Phase 7 delivers **`@kb/auth`** with **`MockCasAuthProvider`** (default `CAS_MOCK=true`): login page submits **工号 + 密码** → `POST /api/v1/auth/login` → mock CAS always succeeds for valid input → JIT user upsert → JWT. Production swaps to real **`CasAuthProvider`** without Web/API changes.

**Supersedes:** earlier draft using `LocalAuthProvider` bcrypt login and `username` field — **CONTEXT D-01–D-26 is authoritative.**

## Key Technical Choices

| Topic | Choice |
|-------|--------|
| User key | `employeeId` / `employee_id`, regex `^\d{4,10}$` |
| Login auth | `CasAuthProvider.login()` — mock or real CAS, **not** local bcrypt |
| User DB | `./data/sqlite/auth.db`, `password_hash` nullable, `auth_source` column |
| JWT | jose HS256, 7-day TTL, `sub` = user UUID |
| Config | `USER_AUTH_ENABLED`, `JWT_SECRET`, `AUTH_PROVIDER=cas`, `CAS_MOCK=true`, `CAS_SERVER_URL` when mock off |
| Web | `LoginPage` 工号+密码, `localStorage` `kb_access_token` |
| Phase boundary | No register page; no JWT on document routes (Phase 8) |

## AuthProvider Contract

```typescript
export interface LoginInput {
  employeeId: string;
  password: string;
}

export interface AuthProvider {
  login(input: LoginInput): Promise<{ user: AuthUser; tokens: AuthTokens }>;
  validateAccessToken(token: string): Promise<AuthUser>;
  getUserById(id: string): Promise<AuthUser | null>;
}
```

`MockCasAuthProvider`: valid employeeId + non-empty password → success, JIT upsert user.

## References

- `07-CONTEXT.md` — all locked decisions D-01–D-26
- `packages/core/src/registry/document-registry.ts` — SQLite pattern
- `apps/backend/src/auth.ts` — API_KEY bearer (unchanged Phase 7)

---
*Research revised for replan — CONTEXT is source of truth for decisions*
