# Phase 18: Config, Docs & Verification - Context

**Gathered:** 2026-07-17  
**Status:** Ready for execution

<domain>
## Phase Boundary

Ship operator-facing **config**, **documentation**, and an automated **two-user MCP isolation** test so v1.5 is complete and shippable.

**In scope:** PLAT-14, PLAT-15, PLAT-16

**Out of scope:** Hybrid BM25; Web MCP token UI; multi-user stdio sessions; changing tool ACL logic (Phases 16–17)

**Unchanged:** Auth resolver semantics except the `MCP_AUTH_REQUIRED` gate; tool handler ACL wiring
</domain>

<decisions>
## Implementation Decisions

### MCP_AUTH_REQUIRED (PLAT-14)
- **D-01:** Add `MCP_AUTH_REQUIRED` to `@kb/config` env schema — boolean, **default `true`**
- **D-02:** When `USER_AUTH_ENABLED=false`, flag is **ignored** (MCP always global; no auth gate)
- **D-03:** Effective MCP auth gate: `userAuthEnabled && mcpAuthRequired`
  ```typescript
  const mcpAuthActive =
    config.USER_AUTH_ENABLED && config.MCP_AUTH_REQUIRED;
  ```
- **D-04:** Wire into `McpAuthResolver.resolve` — pass `userAuthEnabled: mcpAuthActive` into `resolveBearerToken` (not raw `USER_AUTH_ENABLED`)
- **D-05:** Wire into `stdio.ts` — require `MCP_USER_TOKEN` only when `mcpAuthActive`
- **D-06:** Escape hatch: `USER_AUTH_ENABLED=true` + `MCP_AUTH_REQUIRED=false` → MCP global without token while REST/Web stay JWT-scoped
- **D-07:** Document in `.env.example` next to MCP / user-auth block

### Documentation (PLAT-15)
- **D-08:** Expand README **MCP 配置** section:
  - Auth matrix row for MCP (JWT / API_KEY / off)
  - Streamable HTTP Cursor example with `headers.Authorization`
  - stdio example with `env.MCP_USER_TOKEN`
  - Note: `MCP_AUTH_REQUIRED` escape hatch
- **D-09:** Update README 鉴权矩阵 — replace “MCP 无 / 不受隔离” with v1.5 behavior
- **D-10:** Optionally update repo `.cursor/mcp.json` comment in README only — **do not commit secrets**; keep example headers as placeholders (`<jwt-or-api-key>`)
- **D-11:** Mention tools include `read_around` / `read_file` (README still says “单一工具 search_knowledge” in places — fix while editing)

### Isolation tests (PLAT-16)
- **D-12:** New file `apps/mcp-server/src/mcp-user-isolation.test.ts`
- **D-13:** Two MockCas users + registry with disjoint docs (`doc-a` / `doc-b`)
- **D-14:** Via InMemory MCP client + `runWithMcpCallerContext(resolver.resolve(tokenA))`:
  - `search_knowledge` receives `allowedDocumentIds` containing only A's visible ids
  - `read_file` / `read_around` on B's document → tool `isError` with not-found (use real `ContextService` + mocked registry/vectorStore **or** assert options + ContextService unit path)
- **D-15:** Prefer **real `ContextService`** with mocked registry (doc-b exists) so ACL deny path is exercised end-to-end through the tool
- **D-16:** Assert HTTP POST `/mcp` without Bearer → 401 when `USER_AUTH_ENABLED` + `MCP_AUTH_REQUIRED` (extend `http.test.ts` or isolation file)
- **D-17:** Assert `MCP_AUTH_REQUIRED=false` → resolve without token returns `authMode: "global"`

### Claude's Discretion
- Exact README Chinese wording
- Whether `MCP_USER_TOKEN` is added as optional documented-only env (not in AppConfig schema) — keep as raw `process.env` (Phase 16 D-15); only document it
- Test helper shared with mcp-auth-resolver tests
</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — PLAT-14–16
- `.planning/milestones/v1.5-ROADMAP.md` — Phase 18
- `packages/config/src/env.ts` — env schema pattern
- `apps/mcp-server/src/auth/mcp-auth-resolver.ts` — gate wiring target
- `apps/mcp-server/src/stdio.ts` — MCP_USER_TOKEN bootstrap
- `README.md` — MCP 配置 / 鉴权矩阵
- `.env.example` — operator env template
- `apps/mcp-server/src/server.test.ts` — InMemory + ALS test patterns
</canonical_refs>

<code_context>
## Existing Code Insights

### Ready
- Phases 16–17: auth + tool ACL complete (PLAT-04–13)
- `getToolAllowedDocumentIds` + ContextService ACL
- HTTP auth middleware already calls `authResolver.resolve`

### Gaps
- No `MCP_AUTH_REQUIRED` — auth always follows `USER_AUTH_ENABLED`
- README still documents MCP as unscoped
- No two-user MCP isolation integration test
</code_context>
