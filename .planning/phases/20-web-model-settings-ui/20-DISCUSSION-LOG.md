# Phase 20: Web Model Settings UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20  
**Phase:** 20-web-model-settings-ui  
**Areas discussed:** Post-ship discuss (phase already executed); model settings permission

---

## Warning strength (post-ship)

| Option | Description | Selected |
|--------|-------------|----------|
| Banner only | Persistent amber warning when embedding model edited | ✓ (already shipped) |
| Confirm dialog before save | | |
| Admin-only change | Combined with permission decision below | ✓ |

**User's choice:** Kept banner; added admin-only gate for both embedding and rerank.

---

## Who can edit Embedding / Rerank

| Option | Description | Selected |
|--------|-------------|----------|
| Any logged-in user | | |
| Admin only (`role=admin` or API_KEY service) | Embedding **and** Rerank same gate | ✓ |
| Decide later | | |

**User's choice:** 「3 rerank 和 embedding 同属管理员可配置」— both model groups admin-only.

**Notes:**
- `PATCH /api/v1/settings/models` uses `createAdminRouteOpts` when `USER_AUTH_ENABLED`
- Web: non-admin sees read-only models section; no save button
- Context settings remain editable by any authenticated user
- When user-auth gate off (`VITE_USER_AUTH=false` / `USER_AUTH_ENABLED=false`), models stay editable for local ops

---

## Rerank fields when toggle off

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled inputs | Still submitted on save | ✓ (unchanged) |
| Hide fields | | |

**User's choice:** Implicit keep disabled (option 3 framing was about admin, not hide).

---

*Discussed after Phase 20 execute via `/gsd-discuss-phase 20`*
