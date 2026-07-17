# Phase 17 Summary: Scoped MCP Tools

**Completed:** 2026-07-17  
**Plans:** 3/3  
**Requirements:** PLAT-04, PLAT-07, PLAT-08, PLAT-10, PLAT-11, PLAT-12, PLAT-13

## What Shipped

MCP tools now enforce per-user document isolation using Phase 16 caller context:

1. **ContextService ACL** — optional `allowedDocumentIds`; deny → `document_not_found`
2. **Tool wiring** — all three tools pass `getToolAllowedDocumentIds()` into Search/Context
3. **Bypass semantics** — service/global = no filter; user empty Set = empty filter

## PLAT-04 Status

Complete: auth (Phase 16) + tool ACL (Phase 17). Operator docs and end-to-end two-user harness remain Phase 18 (PLAT-14–16).

## Verification

```
pnpm --filter @kb/core test -- context-service
pnpm --filter @kb/mcp-server test   # 42 passed
```
