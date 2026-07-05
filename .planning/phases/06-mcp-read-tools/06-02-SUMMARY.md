---
phase: 06-mcp-read-tools
plan: 02
subsystem: mcp
tags: [mcp, http, uat, read_around, parity]

requires:
  - phase: 06-01
    provides: read tools on buildMcpServer
provides:
  - HTTP tools/list parity tests for three retrieval tools
  - scripts/uat-read-around.ts and pnpm uat:read-around
affects: []

tech-stack:
  added: []
  patterns:
    - "UAT: search_knowledge → read_around with snake_case args from first hit"

key-files:
  created:
    - scripts/uat-read-around.ts
  modified:
    - apps/mcp-server/src/http.test.ts
    - package.json

requirements-completed: [MCP-10]

duration: 5min
completed: 2026-07-05
---

# Phase 6 Plan 02: HTTP Parity and UAT Summary

**HTTP tools/list/call tests and live stdio UAT for search → read_around workflow**

## Performance

- **Duration:** ~5 min
- **Tasks:** 3 / 3 (Task 3 UAT PASS 2026-07-05)

## Accomplishments

- HTTP tests assert tools/list includes search_knowledge, read_around, read_file
- HTTP tools/call read_around succeeds with mocked contextService
- Added `scripts/uat-read-around.ts` and root script `pnpm uat:read-around`
- Live UAT PASS: search hit → read_around returned chunk with filename + chunkIndex (textLength 249)

## UAT Results

```
status: PASS
query: sample
readAround.chunkCount: 1
firstChunk.filename: ...-sample.txt
firstChunk.chunkIndex: 0
```

Operator checkpoint: auto-approved via successful `pnpm uat:read-around` exit 0.

## Files Created/Modified

- `scripts/uat-read-around.ts`
- `apps/mcp-server/src/http.test.ts`
- `package.json` — `uat:read-around` script

## Deviations

None.
