# Phase 18 Plan 03 Summary: Isolation Tests

**Completed:** 2026-07-17  
**Status:** Done

## Delivered

- `mcp-user-isolation.test.ts` — two MockCas users, real ContextService ACL
- User A cannot `read_file` user B's doc; search ACL scoped
- `MCP_AUTH_REQUIRED=false` → global without token
