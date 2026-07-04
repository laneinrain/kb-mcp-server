---
phase: 04-admin-surfaces-security
plan: 01
subsystem: auth
tags: [fastify, bearer-auth, zod, env-config, api-key]

requires:
  - phase: 03-mcp-search-server
    provides: Fastify backend with /api/v1/documents and /api/v1/search routes
provides:
  - AUTH_ENABLED and API_KEY config validation in @kb/config
  - Optional Bearer auth on /api/v1/* via manual preHandlers
  - Public /health* and /docs when auth enabled
affects: [04-02-cli, 04-03-web, 04-04-static-spa]

tech-stack:
  added: ["@fastify/bearer-auth@10.1.2"]
  patterns: ["addHook false + routeOpts preHandler for scoped auth", "superRefine conditional API_KEY validation"]

key-files:
  created:
    - apps/backend/src/auth.ts
    - apps/backend/src/auth.test.ts
  modified:
    - packages/config/src/env.ts
    - packages/config/src/env.test.ts
    - .env.example
    - apps/backend/src/index.ts
    - apps/backend/src/routes/documents.ts
    - apps/backend/src/routes/search.ts
    - apps/backend/package.json

key-decisions:
  - "Use addHook false on @fastify/bearer-auth and apply verifyBearerAuth only via routeOpts on /api/v1/*"
  - "Parse AUTH_ENABLED from env strings with explicit true/false transform instead of z.coerce.boolean"

patterns-established:
  - "registerBearerAuthIfEnabled + apiRouteOpts pattern for optional scoped Bearer auth"
  - "DocumentsDeps/SearchDeps routeOpts injection for per-route preHandlers"

requirements-completed: [CONF-03]

duration: 5min
completed: 2026-07-04
---

# Phase 4 Plan 01: Optional API Key Auth Summary

**Optional Bearer API key auth via AUTH_ENABLED/API_KEY with manual preHandlers on /api/v1/* only, keeping /health* and /docs public**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-04T12:14:00Z
- **Completed:** 2026-07-04T12:19:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Extended `@kb/config` with `AUTH_ENABLED` (default false) and optional `API_KEY` with `superRefine` validation
- Added `registerBearerAuthIfEnabled` and `apiRouteOpts` in `apps/backend/src/auth.ts`
- Wired `@fastify/bearer-auth` with `addHook: false`; protected all `/api/v1/documents*` and `/api/v1/search` routes
- Added auth unit tests (401/200 matrix) plus config validation tests
- Updated `.env.example` with documented auth section

## Task Commits

1. **Task 1: Extend @kb/config for AUTH_ENABLED and API_KEY** - `74fae80` (feat)
2. **Task 2: Bearer auth module, route preHandlers, and tests** - `8e324b6` (feat)

## Test Results

- `pnpm --filter @kb/config test` — 4 passed
- `pnpm --filter @kb/backend test` — 15 passed (4 files)

## Files Created/Modified

- `packages/config/src/env.ts` - AUTH_ENABLED/API_KEY schema with conditional validation
- `packages/config/src/env.test.ts` - Auth config test cases including exit-on-missing-key
- `.env.example` - Documented AUTH_ENABLED and API_KEY
- `apps/backend/src/auth.ts` - Bearer auth registration and routeOpts helper
- `apps/backend/src/auth.test.ts` - 401/200 matrix for protected and public routes
- `apps/backend/src/index.ts` - Auth registration before API routes
- `apps/backend/src/routes/documents.ts` - routeOpts preHandler on all CRUD routes
- `apps/backend/src/routes/search.ts` - routeOpts preHandler on search route
- `apps/backend/package.json` - @fastify/bearer-auth dependency

## Decisions Made

- Used `addHook: false` to avoid global bearer hook breaking public health/docs routes
- Custom boolean transform for `AUTH_ENABLED` env strings (Zod coerce treats `"false"` as true)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AUTH_ENABLED env string parsing**
- **Found during:** Task 1 (config tests)
- **Issue:** `z.coerce.boolean()` treats env string `"false"` as true (`Boolean("false") === true`)
- **Fix:** Custom union transform mapping `"true"`/`"1"` to true, everything else to false
- **Files modified:** packages/config/src/env.ts
- **Commit:** 74fae80

**2. [Rule 3 - Blocking] Switched exit test from subprocess to process.exit mock**
- **Found during:** Task 1 (config tests on Windows)
- **Issue:** Subprocess spawn with bare Windows paths failed with ERR_UNSUPPORTED_ESM_URL_SCHEME
- **Fix:** Used `vi.spyOn(process, "exit")` with console.error assertion per plan's mock alternative
- **Files modified:** packages/config/src/env.test.ts
- **Commit:** 74fae80

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes required for correct env parsing and reliable tests. No scope creep.

## Issues Encountered

None beyond deviations above.

## User Setup Required

None - optional auth is off by default. To enable: set `AUTH_ENABLED=true` and `API_KEY` in `.env`.

## Next Phase Readiness

- Backend auth gate ready for CLI (04-02) and web admin (04-03) to send Bearer tokens
- No MCP HTTP auth changes (deferred per plan)

## Self-Check: PASSED

- FOUND: packages/config/src/env.ts
- FOUND: apps/backend/src/auth.ts
- FOUND: apps/backend/src/auth.test.ts
- FOUND: .planning/phases/04-admin-surfaces-security/04-01-SUMMARY.md
- FOUND: 74fae80
- FOUND: 8e324b6

---
*Phase: 04-admin-surfaces-security*
*Completed: 2026-07-04*
