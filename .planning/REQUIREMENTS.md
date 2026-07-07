# Requirements: kb-mcp-server

**Defined:** 2026-07-07  
**Milestone:** v1.3 Mock CAS Admin Console  
**Core Value:** An MCP client can reliably semantic-search ingested documents through a stable tool interface.

## Milestone Goal

When `CAS_MOCK=true` and `USER_AUTH_ENABLED=true`, provide a **complete user administration backend** for local/scaffold deployments: self-service registration, a built-in administrator account, account directory, and cross-user document management — without changing the production CAS swap path (`CAS_MOCK=false`).

## v1.3 Requirements

### Mock Local Auth & Admin Bootstrap

- [x] **ADMIN-01**: When `CAS_MOCK=true`, bootstrap admin user 工号 `00000` / `admin123` on startup (`auth_source=local`, `role=admin`)
- [x] **ADMIN-02**: `00000` reserved for admin bootstrap; `00000000` remains system-only (non-loginable); registered `local` users use `^\d{4,10}$` or alphanumeric per register validation
- [x] **AUTH-07**: `POST /api/v1/auth/register` creates `local` user with bcrypt `password_hash` when `CAS_MOCK=true`; rejects duplicate `employee_id`
- [x] **AUTH-08**: Mock login validates bcrypt for `local` users; JIT `cas` users keep any-non-empty-password behavior on first login
- [x] **AUTH-09**: JWT payload includes `role: "admin" | "user"`; `validateAccessToken` returns role on `AuthUser`
- [x] **AUTH-10**: Register and admin bootstrap disabled when `CAS_MOCK=false` (404 or 403)

### Admin REST API

- [x] **USER-05**: `GET /api/v1/admin/users` — admin-only; returns all accounts (id, employeeId, authSource, role, createdAt, documentCount)
- [x] **USER-06**: Admin JWT can list/get/delete **any** user's documents (not limited to own + system)
- [x] **USER-07**: Admin JWT can upload documents assigned to a target `userId` via `POST /api/v1/admin/users/:userId/documents`
- [x] **USER-08**: Non-admin JWT receives 403 on `/api/v1/admin/*` routes
- [x] **USER-09**: Regular user document routes unchanged (own + system legacy only)

### Web Admin Console (简体中文)

- [ ] **WEB-02**: Register page — employeeId + password + confirm; links to login; only when mock auth enabled
- [ ] **WEB-05**: Admin-only **用户管理** tab visible when logged-in user has `role=admin`
- [ ] **WEB-06**: User list table: employeeId, authSource, createdAt, document count; click row → user's documents
- [ ] **WEB-07**: Admin document view: list/upload/delete for selected user (reuses upload/dedup outcomes)
- [ ] **WEB-08**: Non-admin users do not see admin tab or routes

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ADMIN-01 | 10 | Complete |
| ADMIN-02 | 10 | Complete |
| AUTH-07 | 10 | Complete |
| AUTH-08 | 10 | Complete |
| AUTH-09 | 10 | Complete |
| AUTH-10 | 10 | Complete |
| USER-05 | 11 | Complete |
| USER-06 | 11 | Complete |
| USER-07 | 11 | Complete |
| USER-08 | 11 | Complete |
| USER-09 | 11 | Complete |
| WEB-02 | 12 | Pending |
| WEB-05 | 12 | Pending |
| WEB-06 | 12 | Pending |
| WEB-07 | 12 | Pending |
| WEB-08 | 12 | Pending |

**Coverage:** 11/16

## Out of Scope (v1.3)

- Production `CasAuthProvider` implementation
- Per-user MCP auth / MCP document scoping (PLAT-04)
- Admin features when `CAS_MOCK=false`
- Password reset / email verification
- User disable/delete (list + doc management only)
- OAuth / LDAP / real CAS integration

## Key Decisions (locked for planning)

| Decision | Rationale |
|----------|-----------|
| Admin only in `CAS_MOCK=true` | Scaffold/dev operator console; production uses company CAS |
| Hardcoded 工号 `00000` / `admin123` | Explicit user request; documented in README + `.env.example` warning |
| `role` column on `users` table | Simple RBAC without separate roles table |
| bcrypt for `local` users | Real password validation for registered + admin accounts |
| Admin routes under `/api/v1/admin/*` | Clear separation from user-scoped routes |
| JWT carries `role` claim | Web can gate admin tab without extra round-trip |

---

*Created via `/gsd-new-milestone` 2026-07-07*
