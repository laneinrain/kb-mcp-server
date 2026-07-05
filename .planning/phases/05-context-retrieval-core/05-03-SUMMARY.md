---
phase: 05-context-retrieval-core
plan: 03
subsystem: api
tags: [settings, fastify, react, zod, context-service, admin-ui]

requires:
  - phase: 05-01
    provides: SettingsStore getContextConfig/updateContextConfig, chunk config
  - phase: 05-02
    provides: ContextService factory and live settings reads
provides:
  - GET /api/v1/settings and PATCH /api/v1/settings/context
  - ContextService wired in backend DI alongside SearchService
  - Web admin 设置 tab with 分块 (read-only) and 上下文检索 (editable)
affects:
  - 06-01 (MCP read_around/read_file tools)
  - future REST context endpoints (API-06)

tech-stack:
  added: []
  patterns:
    - "Settings routes mirror search.ts Zod + routeOpts Bearer gate"
    - "SettingsPanel uses useQuery + useMutation like SearchPanel/UploadPanel"
    - "Client and server both validate readAroundWindowMax >= readAroundWindowDefault"

key-files:
  created:
    - apps/backend/src/routes/settings.ts
    - apps/backend/src/routes/settings.test.ts
    - apps/web/src/api/settings.ts
    - apps/web/src/components/SettingsPanel.tsx
  modified:
    - apps/backend/src/lib/errors.ts
    - apps/backend/src/services.ts
    - apps/backend/src/index.ts
    - apps/web/src/components/AppShell.tsx
    - apps/web/src/App.tsx

key-decisions:
  - "PATCH requires full ContextSettings body (all five fields) matching Zod schema"
  - "mapContextError added for future REST; settings PATCH uses mapContextSettingsError"

patterns-established:
  - "Grouped settings API returns { chunk, context } with chunk read-only at API level"
  - "Settings tab placed between 搜索 and 使用说明 in AppShell"

requirements-completed: [CORE-01]

duration: 12min
completed: 2026-07-05
---

# Phase 5 Plan 03: Settings API and Web Admin Tab Summary

**Backend GET/PATCH settings with Zod validation and Bearer gate, ContextService DI wiring, and Web 设置 tab with grouped 分块 + 上下文检索 form**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-05T06:54:00Z
- **Completed:** 2026-07-05T07:06:00Z
- **Tasks:** 3 / 3 (Task 3 UAT approved 2026-07-05)
- **Files modified:** 9

## Accomplishments

- `GET /api/v1/settings` returns `{ chunk, context }`; `PATCH /api/v1/settings/context` updates context limits with Zod `.refine(max >= default)`
- `mapContextError` and `mapContextSettingsError` in backend errors module
- `createAppServices` exposes `settingsStore` and `contextService` (ContextService.create with shared registry/vectorStore/settingsStore)
- Web admin **设置** tab with read-only **分块** section and editable **上下文检索** form (five D-11 fields, 简体中文 labels)
- Client validation: 「最大窗口必须大于或等于默认窗口」 before submit

## Task Commits

1. **Tasks 1+2: Backend settings routes + Web admin tab** — `e49e920` (feat)

**Task 3:** Human UAT approved by operator (2026-07-05)

## Files Created/Modified

- `apps/backend/src/routes/settings.ts` — registerSettingsRoutes GET/PATCH
- `apps/backend/src/routes/settings.test.ts` — 4 tests (GET, PATCH, validation 400, createAppServices wiring)
- `apps/backend/src/lib/errors.ts` — mapContextError, mapContextSettingsError
- `apps/backend/src/services.ts` — settingsStore + contextService on AppServices
- `apps/backend/src/index.ts` — registerSettingsRoutes after search
- `apps/web/src/api/settings.ts` — fetchSettings, updateContextSettings
- `apps/web/src/components/SettingsPanel.tsx` — grouped 简体中文 settings form
- `apps/web/src/components/AppShell.tsx` — settings tab
- `apps/web/src/App.tsx` — SettingsPanel render

## Decisions Made

- PATCH schema requires all five context fields (not partial patch) — aligns with full-form save in SettingsPanel
- Rebuilt `@kb/core` dist before backend tests so ContextService export resolves in createAppServices test

## Deviations from Plan

None — plan executed as written for Tasks 1–2.

## Human Verification (Task 3)

Operator UAT **approved** 2026-07-05 — Web **设置** tab save/reload verified.

## Issues Encountered

- `@kb/core` dist was stale — `pnpm --filter @kb/core build` required before createAppServices test could import ContextService

## Next Phase Readiness

- Settings API and admin UI UAT complete
- ContextService wired in backend; Phase 6 MCP tools can use same services path
- mapContextError ready for future REST read_around/read_file endpoints

## Self-Check: PASSED

- FOUND: apps/backend/src/routes/settings.ts
- FOUND: apps/backend/src/routes/settings.test.ts
- FOUND: apps/web/src/components/SettingsPanel.tsx
- FOUND: apps/web/src/api/settings.ts
- FOUND: commit e49e920
- PASSED: `pnpm --filter @kb/backend test -- settings`
- PASSED: `pnpm --filter @kb/web build`

---
*Phase: 05-context-retrieval-core*
*Completed: 2026-07-05 (all tasks including UAT)*
