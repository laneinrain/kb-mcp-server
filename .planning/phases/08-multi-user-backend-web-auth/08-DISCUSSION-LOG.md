# Phase 8: Multi-User Backend & Web Auth - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 8-multi-user-backend-web-auth
**Areas discussed:** Web JWT, CLI/API_KEY, legacy migration, register, logout, legacy visibility

---

## Web authentication

| Option | Description | Selected |
|--------|-------------|----------|
| JWT only | Web uses 工号 login JWT; remove API key modal | ✓ |
| JWT + API key fallback | Keep ApiKeyModal as backup | |
| Decide later | | |

**User's choice:** JWT only  
**Notes:** User learned JWT vs API_KEY concepts during discussion; wants human Web flow simplified.

---

## CLI / MCP (Phase 8 scope)

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 8 global API_KEY | CLI/MCP keep `.env` API_KEY; defer per-user | ✓ |
| Phase 8 block CLI to system docs only | | |
| Phase 8 CLI JWT login | | |
| Per-user CLI/MCP (long-term) | User initially selected; deferred | noted |

**User's choice:** Option 1 — reply **「1」** after explanation that current API_KEY is unset and CLI unchanged in Phase 8  
**Notes:** User asked what API_KEY is; explained CHERRYIN_API_KEY vs backend API_KEY; AUTH_ENABLED currently off in `.env`.

---

## Legacy document migration

| Option | Description | Selected |
|--------|-------------|----------|
| System default user | Pre-v1.2 docs assigned to system user row | ✓ |
| First login inherits all | | |
| Decide later | | |

**User's choice:** System default user

---

## Legacy visibility (Web)

| Option | Description | Selected |
|--------|-------------|----------|
| Web users cannot see legacy | Service/API_KEY only | |
| All logged-in users see legacy | Shared read in Web lists/search | ✓ |
| Admin-only legacy visibility | | |

**User's choice:** All logged-in users see legacy documents

---

## Registration

| Option | Description | Selected |
|--------|-------------|----------|
| JIT only (no register page) | First CAS login creates user | ✓ |
| Add register page | | |

**User's choice:** JIT only

---

## Logout

| Option | Description | Selected |
|--------|-------------|----------|
| Header logout button | Top bar 「退出登录」 | ✓ |
| Settings page only | | |

**User's choice:** Header logout

---

## Claude's Discretion

- System user seed constant and migration mechanics
- Settings route JWT protection details
- Legacy doc delete UX in Web

## Deferred Ideas

- CLI/MCP per-user isolation (PLAT-04)
- Register page WEB-02
