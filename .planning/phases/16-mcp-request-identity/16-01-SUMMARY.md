# Phase 16 Plan 01 Summary: resolveBearerToken + McpAuthResolver

**Completed:** 2026-07-16  
**Status:** Done

## Delivered

- `packages/auth/src/bearer-resolver.ts` — shared JWT / API_KEY / global resolution
- Backend `createProtectedRouteOpts` refactored to use `resolveBearerToken`
- `apps/mcp-server/src/auth/types.ts` — `McpCallerContext`
- `apps/mcp-server/src/auth/mcp-auth-resolver.ts` — maps bearer → ACL-ready context
- `@kb/auth` dependency added to `@kb/mcp-server`

## Tests

- `@kb/auth` bearer-resolver tests pass
- Backend multi-user auth tests pass (after `@kb/auth` rebuild)
- `mcp-auth-resolver` tests: global / user ACL / service / missing token
