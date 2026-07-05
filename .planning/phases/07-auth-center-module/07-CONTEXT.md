# Phase 7: Auth Center Module - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver an **independent `@kb/auth` module** with a swappable `AuthProvider`, user store (SQLite), **CAS-backed login** (mock in current stage), JWT issuance, and a **简体中文登录页** (工号 + 密码).

**In scope (current delivery):** AUTH-01, AUTH-02 (user store), AUTH-03, AUTH-06, **WEB-01 (login page only)** — `@kb/auth` with **`MockCasAuthProvider`**, `POST /api/v1/auth/login`, login UI wired to backend CAS adapter, README swap docs.

**Login path (locked):** User submits 工号 + 密码 on login page → backend **`CasAuthProvider.login()`** → (mock: always success for valid input) → upsert user → return JWT.

**Out of scope (this wave):** Register page (WEB-02), JWT on document/search routes (AUTH-04/05), per-user documents (USER-*), real CAS protocol / ticket validation, refresh tokens, admin user UI.

**Unchanged:** Optional `API_KEY` bearer on document/search routes until Phase 8 wires user JWT.
</domain>

<decisions>
## Implementation Decisions

### User Identity (工号)
- **D-01:** Primary user identifier is **工号** (employee ID), not generic username or email login.
- **D-02:** API JSON fields use **`employeeId`** (camelCase, consistent with `documentId`) for register and login request bodies; SQLite column **`employee_id`**; JWT claim **`sub`** = internal user UUID (not the工号 string).
- **D-03:** 工号 format: **4–10 digits, numeric only** — regex `^\d{4,10}$`; unique case-insensitive storage; validation error message in Chinese-friendly API text: `"工号须为 4–10 位数字"`.
- **D-04:** Optional **`email`** on register only (not used for login in v1.2); no email verification.

### Registration & Login
- **D-05:** **Register page deferred** in current wave — no WEB-02 yet. Optional dev-only `POST /api/v1/auth/register` with `LocalAuthProvider` may remain behind `AUTH_PROVIDER=local`; **primary path is login only**.
- **D-06:** Login accepts **`employeeId` + `password`** on Web form and API; backend **does not verify password with local bcrypt** on the default path — it delegates to **`CasAuthProvider`** (see D-21–D-23).
- **D-07:** Password field **required non-empty** on login (min 1 char for mock; production CAS enforces real policy). Register-only local password min **8 characters** if register API kept for dev.
- **D-08:** Login page labels: **「工号」** + **「密码」**; placeholder 工号 `"12345678"`.

### CAS Login Flow (current stage + production)
- **D-21:** **All login authentication goes through `CasAuthProvider`** on the backend — Web → `POST /api/v1/auth/login` → provider validates with company CAS (production) or mock (current stage). Backend route handlers stay fixed; only provider implementation swaps.
- **D-22:** **Current stage — `MockCasAuthProvider`:** When `CAS_MOCK=true` (default in v1.2 scaffold), `login({ employeeId, password })` returns success if: (1) `employeeId` matches `^\d{4,10}$`, (2) `password` is non-empty. **No call to real CAS server.** No failure for wrong password in mock mode (always success) — simulates “CAS 鉴权直接成功”.
- **D-23:** After CAS (mock or real) success: **JIT upsert** user in SQLite by `employee_id` if missing; **`password_hash` nullable** for CAS-only users; issue same JWT as today (`sub` = user UUID). Store optional `auth_source: 'cas' | 'local'` in user row or metadata for audit.
- **D-24:** **Login page required in current delivery** (WEB-01 accelerated): Vite/React page at `/login` (简体中文) — 工号 + 密码 → call login API → save token to **`localStorage` `kb_access_token`** → redirect to admin (`/`). Unauthenticated visitors to admin routes redirect to `/login` (minimal WEB-03 behavior for login gate only).
- **D-25:** **Production swap:** Replace `MockCasAuthProvider` with **`CasAuthProvider`** calling company unified CAS with same `login(employeeId, password)` contract (or internal CAS REST — implementation detail hidden in provider). **Login page unchanged** — still 工号 + 密码; only backend CAS client becomes real.
- **D-26:** Env: **`AUTH_PROVIDER=cas`** (default when `USER_AUTH_ENABLED`); **`CAS_MOCK=true`** for scaffold; **`CAS_SERVER_URL`** required when `CAS_MOCK=false`. README documents toggling mock → real CAS without Web changes.

### JWT & Session
- **D-09:** **Access token only**, default TTL **7 days** (`JWT_EXPIRES_IN=604800`); **no refresh token** in v1.2.
- **D-10:** JWT stored in **`localStorage` key `kb_access_token`** after login (login page in current wave). ApiKeyModal remains until Phase 8 fully switches API client to JWT Bearer.

### Config & Coexistence with API_KEY
- **D-11:** **`USER_AUTH_ENABLED`** is a **separate flag** from existing **`AUTH_ENABLED`** / `API_KEY` — both may be enabled during transition (service CLI keeps API key; humans use JWT from Phase 8).
- **D-12:** When `USER_AUTH_ENABLED=false`, auth routes are not registered (404 or disabled response); no JWT config required.
- **D-13:** When `USER_AUTH_ENABLED=true`, **`JWT_SECRET`** required (min 32 chars); user DB at **`AUTH_SQLITE_PATH`** default `./data/sqlite/auth.db` (separate from document registry DB).

### Auth Module Architecture
- **D-14:** Package **`@kb/auth`** exports `AuthProvider`, **`CasAuthProvider`**, **`MockCasAuthProvider`**, optional `LocalAuthProvider` (dev register only), `createJwtPreHandler`, JWT helpers.
- **D-15:** JWT library: **jose** HS256; bcrypt only for optional local register path; CAS login path does not use bcrypt verify.

### Production: Company CAS (Central Authentication Service)
- **D-16:** **Production target IdP** is company-internal **统一 CAS** — `CasAuthProvider` replaces mock; not generic OAuth as primary story.
- **D-17:** **Mock CAS is the v1.2 default** for development (`CAS_MOCK=true`). Production sets `CAS_MOCK=false` + `CAS_SERVER_URL` — same login page and API.
- **D-18:** **`AuthProvider.login(employeeId, password)`** is the stable contract for Web + backend; real CAS integration lives inside `CasAuthProvider` only.
- **D-19:** CAS principal maps to **工号** (`employee_id` column) — same user key for document isolation in Phase 8.
- **D-20:** ~~Production Web redirect-only CAS~~ **Superseded by D-24/D-25** — keep 工号+密码 login page; backend CAS handles auth (mock now, real later).

### Claude's Discretion
- Exact HTTP status when `USER_AUTH_ENABLED=false` on auth routes (404 vs 503) — prefer **404** `{ error: "not_found", message: "User auth is disabled" }`.
- Optional display name field on register — omit unless needed for Phase 8 UI.
- README production note: **use company CAS in production**; local register/login is dev-only; recommend gateway/IP allowlist if local auth left enabled in staging.
- `AUTH_PROVIDER=cas` default; `CAS_MOCK=true` for scaffold; `CAS_SERVER_URL` when mock off.
- Login failure in **mock mode** only on invalid 工号 format or empty password — not on “wrong password”.

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
- `apps/web/src/components/ApiKeyModal.tsx` — superseded gradually: login page + JWT client in current wave

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
- `apps/backend/src/services.ts` — construct **`MockCasAuthProvider`** (or `CasAuthProvider`) from config when `USER_AUTH_ENABLED`.
- `apps/backend/src/routes/auth.ts` — `POST /api/v1/auth/login` calls **`provider.login(employeeId, password)`** only (no direct bcrypt).
- `apps/web/src/pages/LoginPage.tsx` (new) — 工号 + 密码 → login API → localStorage JWT → redirect `/`.
- Phase 8: JWT preHandler on document/search; logout (WEB-04); register page if still needed.

</code_context>

<specifics>
## Specific Ideas

- User requirement (v1.2 milestone): **鉴权中心独立模块**，便于生产环境替换 — satisfied by `AuthProvider` + README swap docs.
- User requirement: Web 后台登录时 **必须填写工号** — API and DB use `employeeId` / `employee_id`; numeric 4–10 digits.
- User chose **open registration** + **7-day JWT** without refresh token.
- **Production:** company **统一 CAS** — backend `CasAuthProvider`; current stage **`MockCasAuthProvider` 直接鉴权成功**.
- **Current wave:** 登录页（工号+密码）+ 后台走 CAS 适配层（mock），非本地 bcrypt 验密。

</specifics>

<deferred>
## Deferred Ideas

- **Refresh tokens** — deferred; 7-day access token sufficient for v1.2 scaffold.
- **Admin-only registration / 管理员创建工号** — user chose open register; admin UI deferred (AUTH-12).
- **Email / 手机号登录** — out of scope; 工号-only login.
- **Rate limiting on register/login** — document in README; implement in production hardening phase.
- **Merge USER_AUTH_ENABLED with AUTH_ENABLED** — rejected; keep independent (D-11).
- **Real CAS protocol** (ticket, redirect, SLO, `CAS_SERVER_URL` HTTP client) — swap mock provider only; login page/API unchanged.
- **Register page (WEB-02)** — deferred; JIT user on first successful CAS login.
- **Open local register** — optional dev-only behind `AUTH_PROVIDER=local`; not primary path.
- **Generic OAuth2/OIDC provider** — not the primary production path; CAS is (D-16).

</deferred>

---

*Phase: 07-auth-center-module*
*Context gathered: 2026-07-05; updated 2026-07-05 — CAS mock login + login page in current wave*
