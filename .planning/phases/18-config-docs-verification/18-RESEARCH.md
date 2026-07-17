# Phase 18: Config, Docs & Verification - Research

**Researched:** 2026-07-17

## MCP_AUTH_REQUIRED semantics

| USER_AUTH_ENABLED | MCP_AUTH_REQUIRED | MCP behavior |
|-------------------|-------------------|--------------|
| false | *ignored* | Global, no token |
| true | true (default) | JWT / API_KEY required; user ACL |
| true | false | Global MCP escape hatch; REST still JWT |

**Wire point:** Today `McpAuthResolver` passes `config.USER_AUTH_ENABLED` into `resolveBearerToken`. Change to:

```typescript
const mcpAuthActive =
  this.deps.config.USER_AUTH_ENABLED && this.deps.config.MCP_AUTH_REQUIRED;
```

stdio `resolveStdioCallerContext(services.config.USER_AUTH_ENABLED, ...)` → use `mcpAuthActive` instead.

## Cursor mcp.json examples (docs only)

**HTTP:**
```json
{
  "mcpServers": {
    "kb-mcp-server": {
      "url": "http://127.0.0.1:3100/mcp",
      "headers": {
        "Authorization": "Bearer <jwt-or-api-key>"
      }
    }
  }
}
```

**stdio:**
```json
{
  "mcpServers": {
    "kb-mcp-server": {
      "command": "pnpm",
      "args": ["--filter", "@kb/mcp-server", "dev:stdio"],
      "env": {
        "MCP_USER_TOKEN": "<jwt>",
        "DOTENV_CONFIG_QUIET": "true"
      }
    }
  }
}
```

Obtain JWT via `POST /api/v1/auth/login` (Web login or curl).

## Isolation test design

Avoid live Chroma/CherryIn for PLAT-16 CI:

```
MockCasAuthProvider → tokenA, tokenB
DocumentRegistry mock → listDocumentsForUser / getDocument / getChunkIds
ChromaVectorStore mock → getByIds for allowed docs only path
ContextService.create(real) + SearchService mock (spy on allowedDocumentIds)
McpAuthResolver.resolve(tokenA)
runWithMcpCallerContext(ctx) + InMemory client.callTool
```

| Case | Expect |
|------|--------|
| User A search | `allowedDocumentIds` = {doc-a, …system?} |
| User A read_file(doc-b) | `isError`, message not found |
| User A read_file(doc-a) | success |
| MCP_AUTH_REQUIRED=false | resolve(undefined) → global |

System legacy docs: if registry includes system-owned docs in A's list, mirror REST — include them in allowed set (resolver already uses `listDocumentsForUser`).

## README stale bits to fix

| Location | Current | Target |
|----------|---------|--------|
| MCP 配置 intro | “单一工具 search_knowledge” | Three tools |
| 鉴权矩阵 MCP row | 无 / 不受隔离 | JWT/API_KEY / 用户文档集 |
| Env table | missing MCP_AUTH_REQUIRED, MCP_USER_TOKEN | Add both |

## Risks

| Risk | Mitigation |
|------|------------|
| Default MCP_AUTH_REQUIRED=true surprises existing MCP clients when USER_AUTH_ENABLED=true | Document clearly; escape hatch MCP_AUTH_REQUIRED=false |
| Integration test flaky with ALS | Use `runWithMcpCallerContext` (proven in Phase 17 server tests) |
| Committing real tokens in mcp.json | Placeholders only in README |
