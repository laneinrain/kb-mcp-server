# Phase 8 Research: Multi-User Backend & Web Auth

**Researched:** 2026-07-05  
**Phase:** 8 — Multi-User Backend & Web Auth  
**Requirements:** AUTH-04, AUTH-05, USER-01–04, WEB-03, WEB-04 (WEB-02 deferred per CONTEXT D-05)

## RESEARCH COMPLETE

## Executive Summary

Phase 8 adds **`user_id`** to the document registry and Chroma chunk metadata, seeds a **system user** for legacy rows, and protects `/api/v1/documents|search|settings` with a **composite preHandler**: valid **JWT** (user-scoped) **or** valid **API_KEY** (service/global). Web drops `ApiKeyModal` and uses JWT-only with header logout.

## Key Technical Choices

| Topic | Choice |
|-------|--------|
| System user | `employee_id = '00000000'`, `auth_source = 'system'`, stable UUID via `ensureSystemUser()` |
| Legacy visibility | SQL/Chroma filter: `user_id = authUser.id OR user_id = SYSTEM_USER_ID` |
| Legacy delete (Web) | JWT users cannot delete system-owned docs; service API_KEY can |
| Auth preHandler | New `createUserOrApiKeyPreHandler` in `apps/backend/src/auth.ts` wrapping `@kb/auth` JWT + `@fastify/bearer-auth` verify |
| When USER_AUTH off | Existing behavior unchanged (optional API_KEY only) |
| Chroma scope | Add `user_id` to upsert metadata; post-query filter hits by allowed user_ids (SQLite authority) |
| CLI | Block direct `@kb/core` ingest when `USER_AUTH_ENABLED`; require REST + `AUTH_ENABLED` + `API_KEY` |
| MCP | No changes |

## Schema Migration

```sql
-- packages/core/src/registry/schema.sql + migration on open
ALTER TABLE documents ADD COLUMN user_id TEXT;
-- backfill NULL → SYSTEM_USER_ID on first startup after upgrade
```

Idempotent migration in `initSettingsStore` or dedicated `runRegistryMigrations(db, systemUserId)`.

## Composite Auth Flow

```
Authorization: Bearer <token>
  �1. Try JWT validate (if USER_AUTH_ENABLED) → request.authUser, request.authMode = 'user'
  2. Else try API_KEY (if AUTH_ENABLED) → request.authMode = 'service'
  3. Else 401
```

Document routes read `authMode` + `authUser` to apply scope.

## Files to Touch (high level)

| Area | Files |
|------|-------|
| Core registry | `schema.sql`, `document-registry.ts`, `types.ts`, migration helper |
| Chroma | `chroma-store.ts` upsert/query filter |
| Ingestion | `ingestion-service.ts` accept `userId` |
| Auth package | `user-store.ts` `ensureSystemUser()`, export `SYSTEM_EMPLOYEE_ID` constant |
| Backend | `auth.ts`, `index.ts`, `routes/documents.ts`, `routes/search.ts`, `routes/settings.ts`, `services.ts` |
| Web | `client.ts`, `App.tsx`, `AppShell.tsx`, remove ApiKeyModal usage |
| CLI | `commands/ingest.ts` guard when USER_AUTH_ENABLED |
| Tests | backend multi-user integration, core registry scope |

## Risks

| Risk | Mitigation |
|------|------------|
| Chroma legacy chunks lack user_id metadata | Migration job or lazy filter via SQLite doc list |
| Dual auth confusion | README matrix for USER_AUTH vs AUTH flags |
| Existing tests without user_id | Migration + test fixtures with system user |

## WEB-02 Status

**Deferred** — CONTEXT D-05; JIT CAS login satisfies user onboarding. Plan traceability: mark WEB-02 as deferred in Phase 8 plans, not implemented.

---
*Supersedes generic multi-user drafts — `08-CONTEXT.md` is authoritative.*
