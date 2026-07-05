---
phase: 06-mcp-read-tools
plan: 01
subsystem: mcp
tags: [mcp, read_around, read_file, context-service, zod]

requires:
  - phase: 05-02
    provides: ContextService readAround/readFile
  - phase: 05-03
    provides: settingsStore + shared SQLite path pattern
provides:
  - buildMcpServer with search_knowledge, read_around, read_file
  - createMcpServices with ContextService + registry + settingsStore
  - MCP tool schemas snake_case at boundary; full ReadAroundResult/ReadFileResult in structuredContent
affects:
  - 06-02 (HTTP parity + UAT)

tech-stack:
  added: []
  patterns:
    - "Tool handlers delegate to ContextService; errors return isError + message"
    - "read_around description includes search hit inline example (D-02)"

key-files:
  created: []
  modified:
    - apps/mcp-server/src/services.ts
    - apps/mcp-server/src/server.ts
    - apps/mcp-server/src/server.test.ts
    - apps/mcp-server/src/stdio.ts
    - apps/mcp-server/src/http.ts

key-decisions:
  - "structuredContent cast via unknown for MCP SDK Record<string, unknown> typing"
  - "ContextError message-only isError aligned with search_knowledge"

requirements-completed: [MCP-07, MCP-08, MCP-09, MCP-11]

duration: 8min
completed: 2026-07-05
---

# Phase 6 Plan 01: MCP Read Tools Registration Summary

**Extended buildMcpServer and createMcpServices to expose read_around and read_file delegating to Phase 5 ContextService**

## Performance

- **Duration:** ~8 min
- **Tasks:** 4 / 4
- **Tests:** 22 passed (`pnpm --filter @kb/mcp-server test`)

## Accomplishments

- `createMcpServices()` wires `initSettingsStore`, `getDocumentRegistry`, `ContextService.create` (same SQLite as backend)
- Registered `read_around` and `read_file` with Zod snake_case schemas and D-02 inline search example in description
- stdio + HTTP entrypoints pass `contextService` to shared `buildMcpServer`
- Unit tests: 3-tool list, delegation, ContextError isError, forbidden write tools grep

## Files Modified

- `apps/mcp-server/src/services.ts` — McpServices + ContextService wiring
- `apps/mcp-server/src/server.ts` — read tool registration
- `apps/mcp-server/src/server.test.ts` — expanded tests
- `apps/mcp-server/src/stdio.ts`, `http.ts` — factory signature update

## Deviations

None — automated plan execution.

## Next

06-02: HTTP tools/list parity + UAT script
