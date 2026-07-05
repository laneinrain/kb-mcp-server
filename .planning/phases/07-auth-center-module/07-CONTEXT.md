# Phase 7: Auth Center Module - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver an **independent `@kb/auth` module** with a swappable `AuthProvider`, local SQLite user store, and **public** REST endpoints for **工号-based** register/login that return JWT access tokens.

**In scope:** AUTH-01, AUTH-02, AUTH-03, AUTH-06 — auth package, user persistence, `/api/v1/auth/register` + `/api/v1/auth/login`, README swap docs.

**Out of scope (Phase 8+):** Web login/register UI (WEB-*), JWT protection on `/api/v1/documents|search` (AUTH-04/05), per-user document isolation (USER-*), refresh tokens, email verification, admin user management, OAuth/OIDC implementation.

**Unchanged in Phase 7:** Existing optional `API_KEY` bearer on document/search routes (`AUTH_ENABLED` / `apps/backend/src/auth.ts`).
</domain>

<decisions>
## Implementation Decisions

### User Identity (工号)
- **D-01:** Primary user identifier is **工号** (employee ID), not generic username or email login.
- **D-02:** API JSON fields use **`employeeId`** (camelCase, consistent with `documentId`) for register and login request bodies; SQLite column **`employee_id`**; JWT claim **`sub`** = internal user UUID (not the工号 string).
- **D-03:** 工号 format: **4–10 digits, numeric only** — regex `^\d{4,10}$`; unique case-insensitive storage; validation error message in Chinese-friendly API text: `"工号须为 4–10 位数字"`.
- **D-04:** Optional **`email`** on register only (not used for login in v1.2); no email verification.

### Registration & Login
- **D-05:** **Open registration** when `USER_AUTH_ENABLED=true` — any valid unused 工号 can self-register with password (suitable for dev / internal network).
- **D-06:** Login accepts **`employeeId` + `password`** only; invalid credentials return generic `401` with `"工号或密码错误"` (no user enumeration).
- **D-07:** Password minimum **8 characters**; no complexity rules in v1.2 (internal scaffold).
- **D-08:** Phase 8 Web UI login form label **「工号」** (not 「用户名」); placeholder example `"12345678"`.

### JWT & Session
- **D-09:** **Access token only**, default TTL **7 days** (`JWT_EXPIRES_IN=604800`); **no refresh token** in v1.2.
- **D-10:** Token storage is **Phase 8** concern; Phase 7 only issues JWT. Phase 8 should use `localStorage` key `kb_access_token` (replacing `sessionStorage` `kb_api_key` for user sessions).

### Config & Coexistence with API_KEY
- **D-11:** **`USER_AUTH_ENABLED`** is a **separate flag** from existing **`AUTH_ENABLED`** / `API_KEY` — both may be enabled during transition (service CLI keeps API key; humans use JWT from Phase 8).
- **D-12:** When `USER_AUTH_ENABLED=false`, auth routes are not registered (404 or disabled response); no JWT config required.
- **D-13:** When `USER_AUTH_ENABLED=true`, **`JWT_SECRET`** required (min 32 chars); user DB at **`AUTH_SQLITE_PATH`** default `./data/sqlite/auth.db` (separate from document registry DB).

### Auth Module Architecture
- **D-14:** Package **`@kb/auth`** exports `AuthProvider`, `LocalAuthProvider`, `createJwtPreHandler`, JWT helpers — production swaps provider implementation, not backend route handlers.
- **D-15:** Password hashing: **bcryptjs** cost 12; JWT library: **jose** HS256; framework-agnostic package (no Fastify import in core provider).

### Claude's Discretion
- Exact HTTP status when `USER_AUTH_ENABLED=false` on auth routes (404 vs 503) — prefer **404** `{ error: "not_found", message: "User auth is disabled" }`.
- Optional display name field on register — omit unless needed for Phase 8 UI.
- README production note: recommend gateway/IP allowlist for open register in production (document only, no code gate in Phase 7).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 7 goal and success criteria
- `.planning/REQUIREMENTS.md` — AUTH-01, AUTH-02, AUTH-03, AUTH-06
- `.planning/PROJECT.md` — v1.2 milestone: independent auth center, multi-user direction
- `.planning/STATE.md` — v1.2 decisions (JWT, `@kb/auth`, MCP unchanged)

### Research & plans (update plans to reflect 工号 decisions)
- `.planning/phases/07-auth-center-module/07-RESEARCH.md` — technical baseline (replace `username` semantics with `employeeId` per D-01–D-03)
- `.planning/phases/07-auth-center-module/07-01-PLAN.md` — Wave 1 package scaffold
- `.planning/phases/07-auth-center-module/07-02-PLAN.md` — Wave 2 REST routes

### Existing code patterns
- `apps/backend/src/auth.ts` — existing API_KEY bearer; do not remove in Phase 7
- `packages/config/src/env.ts` — Zod env + monorepo path resolution pattern
- `packages/core/src/registry/document-registry.ts` — better-sqlite3 prepared statement pattern
- `apps/web/src/components/ApiKeyModal.tsx` — current sessionStorage API key UX (replaced in Phase 8, not Phase 7)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/auth.ts` — `apiRouteOpts()` pattern for route-level preHandlers; Phase 8 adds JWT preHandler alongside or instead of API key.
- `packages/config/src/env.ts` — `resolveRepoRelativePath`, `superRefine` conditional validation for new auth env vars.
- `packages/core` SQLite pattern — schema.sql + prepared statements for `@kb/auth` user store.

### Established Patterns
- API errors: `{ error: string, message: string }` — auth routes must match.
- JSON field naming: camelCase in API bodies/responses (`documentId`, `chunkCount`).
- Web admin copy: 简体中文 (Phase 8 login labels per D-08).

### Integration Points
- `apps/backend/src/services.ts` — construct `LocalAuthProvider` from config.
- `apps/backend/src/index.ts` — register auth routes before bearer auth; auth routes stay public.
- Phase 8: `createJwtPreHandler` on document/search routes; Web replaces ApiKeyModal with login page using 工号.

</code_context>

<specifics>
## Specific Ideas

- User requirement (v1.2 milestone): **鉴权中心独立模块**，便于生产环境替换 — satisfied by `AuthProvider` + README swap docs.
- User requirement: Web 后台登录时 **必须填写工号** — API and DB use `employeeId` / `employee_id`; numeric 4–10 digits.
- User chose **open registration** + **7-day JWT** without refresh token.

</specifics>

<deferred>
## Deferred Ideas

- **Refresh tokens** — deferred; 7-day access token sufficient for v1.2 scaffold.
- **Admin-only registration / 管理员创建工号** — user chose open register; admin UI deferred (AUTH-12).
- **Email / 手机号登录** — out of scope; 工号-only login.
- **Rate limiting on register/login** — document in README; implement in production hardening phase.
- **Merge USER_AUTH_ENABLED with AUTH_ENABLED** — rejected; keep independent (D-11).

</deferred>

---

*Phase: 07-auth-center-module*
*Context gathered: 2026-07-05*
