# Phase 8: Multi-User Backend & Web Auth - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire **user JWT** onto protected `/api/v1` document and search routes, add **`user_id` scoping** in SQLite registry and Chroma metadata, migrate pre-v1.2 documents, and complete Web auth UX (logout, full route gate, remove API-key modal for humans).

**In scope:** AUTH-04, AUTH-05, USER-01, USER-02, USER-03, USER-04, WEB-03 (complete), WEB-04; optional WEB-02 **deferred** (JIT login only).

**Out of scope:** Per-user MCP/CLI login (PLAT-04 — deferred); hash dedup upload (Phase 9); register page (WEB-02); refresh tokens; real CAS implementation.

**CLI/MCP in Phase 8:** Unchanged service model — global `API_KEY` via `AUTH_ENABLED` when operators enable it; not per-user isolation this phase.
</domain>

<decisions>
## Implementation Decisions

### Web authentication (human users)
- **D-01:** When `USER_AUTH_ENABLED=true`, Web admin uses **JWT only** — remove `ApiKeyModal` and sessionStorage API-key flow for document/search calls; `api/client.ts` sends `Authorization: Bearer <JWT>` from `localStorage` `kb_access_token` only.
- **D-02:** On **401** from protected routes, Web **redirects to `/login`** (clear invalid token if needed) — do not prompt for API key.
- **D-03:** Complete **WEB-03** — all admin routes behind login gate (already partial in Phase 7); authenticated session required before rendering `App`.

### Logout (WEB-04)
- **D-04:** Add **「退出登录」** control in **`AppShell` header** (top bar beside title); on click: `clearAccessToken()`, redirect to `/login`. No backend logout endpoint required (stateless JWT).

### Registration (WEB-02)
- **D-05:** **No register page** — continue **JIT** user creation on first successful CAS login (Phase 7 D-23). WEB-02 deferred.

### Backend route protection (AUTH-04, AUTH-05, USER-04)
- **D-06:** When `USER_AUTH_ENABLED=true`, **`/api/v1/documents`** and **`/api/v1/search`** (and settings mutations if exposed to Web) require valid **user JWT** via `createJwtPreHandler` from `@kb/auth`.
- **D-07:** Invalid/missing/expired JWT → **401** with existing shape `{ error: "unauthorized", message: "..." }` (AUTH-05).
- **D-08:** **`/health*`**, **`/docs`**, and **`POST /api/v1/auth/login`** remain **public**. Health stays unauthenticated for ops.

### JWT vs API_KEY coexistence (AUTH-04, D-11 from Phase 7)
- **D-09:** **`USER_AUTH_ENABLED`** and **`AUTH_ENABLED`/`API_KEY`** remain **independent flags** (Phase 7 D-11).
- **D-10:** **JWT path:** Request authenticated as `authUser` from token; document list/search/upload/delete scoped per USER-02 rules below.
- **D-11:** **API_KEY path (service/CLI):** When `AUTH_ENABLED=true`, valid `Authorization: Bearer <API_KEY>` is accepted **in addition to JWT** on the same routes — treated as **service principal** with **global access to all documents** (no user_id filter). Enables CLI/MCP-style automation without user login.
- **D-12:** PreHandler order: accept **either** valid JWT **or** valid API_KEY when both flags enabled; reject if neither valid when `USER_AUTH_ENABLED=true` on protected routes.
- **D-13:** When `USER_AUTH_ENABLED=true`, **disable CLI direct `@kb/core` ingest path** — CLI must use REST with `API_KEY` (set `AUTH_ENABLED=true` in env) so uploads respect server-side user/service rules. Document in README.

### Multi-user documents (USER-01, USER-02)
- **D-14:** Add **`user_id TEXT NOT NULL`** (FK to auth users UUID) on `documents` table; Chroma chunk metadata includes **`user_id`** on upsert.
- **D-15:** **Owner scope:** Authenticated JWT user may list/get/delete/upload documents where `user_id = authUser.id` **OR** document is **legacy-shared** (see D-17).
- **D-16:** Cross-user access → **404** (not 403) for get/delete to avoid leaking existence (match existing `not_found` pattern).

### Legacy document migration (USER-03)
- **D-17:** On first startup after migration, assign all rows with **NULL/missing `user_id`** to a designated **`system` user** in auth DB — stable UUID created once (e.g. `auth_source: 'system'`, fixed `employee_id` like `00000000` or internal label `__system__` — planner picks one locked constant).
- **D-18:** **Legacy visibility (user choice):** Migrated pre-v1.2 documents are **visible to all logged-in Web users** (shared read in list/search/get) but **only the owning user** may delete/replace their **own** uploads; **system-owned legacy docs** deletable only via **API_KEY service path** (or omit delete for legacy in Web — planner: prefer **no delete button in Web for system-owned** rows).
- **D-19:** New uploads after Phase 8 always set `user_id` to authenticated JWT user.

### MCP
- **D-20:** **MCP HTTP unchanged** — continues global corpus semantics; no per-user MCP auth in Phase 8 (REQUIREMENTS out of scope).

### CLI (Phase 8 scope — user chose option 1)
- **D-21:** **Phase 8 does not add CLI user login or per-user API keys.** CLI continues **`API_KEY` from `.env`** when `AUTH_ENABLED=true` with **global document access** (D-11). Per-user CLI/MCP isolation → **deferred** (see `<deferred>`).

### Claude's Discretion
- Exact `system` user seed SQL and constant `employee_id` string.
- Settings GET/PUT: protect with JWT when `USER_AUTH_ENABLED` (recommended yes for Web parity).
- Integration test fixtures for two JWT users + API_KEY service user.
- Whether Web shows a badge on legacy-shared vs owned documents (optional UI polish).
- Migration idempotency and backup note in README.

</decisions>

<specifics>
## Specific Ideas

- User unfamiliar with JWT/API_KEY/JIT — Phase 8 keeps mental model simple: **humans = 工号 login + JWT**; **scripts/CLI = optional global API_KEY**.
- User wants **all logged-in users to see old documents** after upgrade (shared legacy corpus in Web).
- User initially asked for CLI per-user isolation — **explicitly deferred to post–Phase 8**; Phase 8 ships global `API_KEY` for CLI only.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 8 goal and success criteria
- `.planning/REQUIREMENTS.md` — AUTH-04/05, USER-01–04, WEB-02–04
- `.planning/PROJECT.md` — v1.2 multi-user direction
- `.planning/STATE.md` — current milestone progress

### Phase 7 locked decisions (carry forward)
- `.planning/phases/07-auth-center-module/07-CONTEXT.md` — 工号, Mock CAS, JWT localStorage, USER_AUTH_ENABLED separate from AUTH_ENABLED
- `.planning/phases/07-auth-center-module/07-VERIFICATION.md` — Phase 7 UAT pass baseline

### Implementation patterns
- `packages/auth/src/fastify.ts` — `createJwtPreHandler`
- `apps/backend/src/auth.ts` — existing `@fastify/bearer-auth` + `apiRouteOpts`
- `apps/backend/src/routes/documents.ts` — routes to protect and scope
- `apps/backend/src/routes/search.ts` — search scope
- `packages/core/src/registry/schema.sql` — documents schema migration
- `apps/web/src/api/client.ts` — JWT client; remove API-key modal path
- `apps/web/src/components/AppShell.tsx` — header logout placement
- `apps/cli/src/commands/ingest.ts` — dual-path CLI; restrict when USER_AUTH_ENABLED

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createJwtPreHandler` in `@kb/auth` — attach `request.authUser` after Bearer JWT verify.
- `apiRouteOpts` + `registerBearerAuthIfEnabled` — pattern for optional bearer; extend to JWT-or-API_KEY composite preHandler.
- `LoginPage` + `auth-token.ts` + `main.tsx` gate — Phase 7 Web login; extend AppShell for logout.
- `DocumentRegistry` / `ChromaVectorStore` — add `user_id` filter parameters on list/search/delete/upsert.

### Established Patterns
- API errors: `{ error, message }` camelCase JSON.
- Web copy: 简体中文.
- JWT claim `sub` = user UUID (Phase 7 D-02).

### Integration Points
- `apps/backend/src/index.ts` — register composite auth before document/search routes.
- `apps/backend/src/services.ts` — pass `authProvider` into route deps.
- Migration runs on registry DB open or dedicated migration step on startup.

</code_context>

<deferred>
## Deferred Ideas

- **CLI/MCP per-user authentication and isolation** — user interest noted; target PLAT-04 / future phase; Phase 8 uses global `API_KEY` only.
- **Register page (WEB-02)** — JIT CAS login sufficient.
- **Per-user MCP tool auth** — unchanged global MCP in v1.2.
- **Admin UI to reassign legacy document ownership** — not requested.

</deferred>

---

*Phase: 08-multi-user-backend-web-auth*
*Context gathered: 2026-07-05*
