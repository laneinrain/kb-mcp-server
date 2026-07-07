# Phase 10: Mock Local Auth & Admin Bootstrap - Context

**Gathered:** 2026-07-07  
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `@kb/auth` and backend auth routes so that when **`CAS_MOCK=true`** and **`USER_AUTH_ENABLED=true`**:

1. Bootstrap admin 工号 **`00000`** / password **`admin123`** (`auth_source=local`, `role=admin`)
2. Self-service **`POST /api/v1/auth/register`** for `local` users with bcrypt passwords
3. Login validates bcrypt for `local` users; JIT `cas` users keep any-non-empty-password behavior
4. JWT carries **`role: admin | user`** on `AuthUser`

**In scope:** ADMIN-01, ADMIN-02, AUTH-07, AUTH-08, AUTH-09, AUTH-10

**Out of scope (Phase 11+):** Admin REST (`/api/v1/admin/*`), Web register/admin UI, per-user MCP auth

**Unchanged:** `CasAuthProvider` stub, composite JWT+API_KEY on document routes, MCP global corpus
</domain>

<decisions>
## Implementation Decisions

### Reserved Employee IDs
- **D-01:** **`00000`** — admin bootstrap only; `ensureAdminUser()` creates on startup when `CAS_MOCK=true`; bcrypt password `admin123`; not registerable
- **D-02:** **`00000000`** — system user (existing); remains **non-loginable**; not registerable
- **D-03:** Register rejects `employeeId` in `{00000, 00000000}` with Chinese error `"该工号不可注册"`

### User Roles
- **D-04:** Add SQLite column **`role TEXT NOT NULL DEFAULT 'user'`** on `users`; values `admin` | `user`
- **D-05:** JWT claim **`role`** mirrored in `AuthUser.role`; `signAccessToken` / `verifyAccessToken` extended
- **D-06:** Admin bootstrap sets `role=admin`; register sets `role=user`; JIT cas users get `role=user`

### Local Auth (mock mode only)
- **D-07:** **`auth_source=local`** users require bcrypt `password_hash`; library **`bcryptjs`** (pure JS, no native rebuild)
- **D-08:** Password min **8 characters** on register; login uses bcrypt compare for `local` users
- **D-09:** Register body: `{ employeeId, password }` — same shape as login; optional `email` omitted in v1.3
- **D-10:** Register employeeId validation: **`^\d{4,10}$`** (same as cas JIT); admin `00000` fits pattern but reserved

### Login Behavior (MockCasAuthProvider)
- **D-11:** Lookup user by `employeeId` before auth:
  - `local` → bcrypt verify password; wrong password → `AuthValidationError` `"工号或密码错误"`
  - `cas` (existing JIT) → any non-empty password; upsert if missing
  - `system` → reject login (existing `00000000` block extended to all `auth_source=system`)
- **D-12:** Admin `00000` logs in via `local` bcrypt path (not JIT cas)

### API Guards
- **D-13:** `POST /api/v1/auth/register` returns **404** when `USER_AUTH_ENABLED=false` or `CAS_MOCK=false` (same pattern as disabled login)
- **D-14:** Register duplicate `employee_id` → **409** `{ error: "conflict", message: "工号已存在" }`
- **D-15:** Register validation errors → **400** via `AuthValidationError`

### Bootstrap
- **D-16:** `createAppServices()` when `USER_AUTH_ENABLED && CAS_MOCK`: after `ensureSystemUser()`, call **`ensureAdminUser()`** with fixed bcrypt hash for `admin123`
- **D-17:** Admin password hash computed at bootstrap time via `bcrypt.hash('admin123', 10)` — not stored in env

### Production Isolation
- **D-18:** When `CAS_MOCK=false`: no `ensureAdminUser()`, no register route, login unchanged (CasAuthProvider stub)
- **D-19:** README + `.env.example` warn: `00000/admin123` is scaffold-only; never expose mock mode to public network

### Claude's Discretion
- Idempotent `ensureAdminUser` — upsert if missing; do not reset admin password on every restart if row exists
- Migration for `role` column via `ALTER TABLE` in `openAuthDatabase` or separate migration helper
- Export `register` on `AuthProvider` interface vs `MockCasAuthProvider` only — prefer **provider method** `register()` on interface when mock/local path active

</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — ADMIN-01/02, AUTH-07–10
- `.planning/milestones/v1.3-ROADMAP.md` — Phase 10 plans
- `packages/auth/src/mock-cas-auth-provider.ts` — extend login
- `packages/auth/src/constants.ts` — SYSTEM_EMPLOYEE_ID
- `packages/auth/src/user-store.ts` — UserStore pattern
- `apps/backend/src/routes/auth.ts` — login route pattern
- `apps/backend/src/services.ts` — bootstrap hook
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuthValidationError` — register/login validation
- `validateEmployeeId()` — `packages/auth/src/employee-id.ts`
- `POST /api/v1/auth/login` — Zod body + provider delegation pattern
- `openAuthDatabase` + schema.sql — add column via migration exec

### Integration Points
- `createAppServices()` — add `ensureAdminUser()` after system user when `CAS_MOCK`
- `AuthUser` type — add `role` field
- `jwt.ts` — add `role` to JWT payload
- Login response — include `role` in user object for Web (Phase 12)

</code_context>
