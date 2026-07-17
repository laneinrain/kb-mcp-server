# Phase 18 Plan 01 Summary: MCP_AUTH_REQUIRED

**Completed:** 2026-07-17  
**Status:** Done

## Delivered

- `MCP_AUTH_REQUIRED` in `@kb/config` (default `true`)
- `McpAuthResolver` / stdio use `USER_AUTH_ENABLED && MCP_AUTH_REQUIRED`
- Escape hatch tests; `.env.example` documented
- Core test fixtures updated for new AppConfig field
