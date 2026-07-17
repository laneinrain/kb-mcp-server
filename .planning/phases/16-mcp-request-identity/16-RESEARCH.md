# Phase 16: MCP Request Identity - Research

**Researched:** 2026-07-16

## REST Auth Pattern (reference)

| Step | REST (`createProtectedRouteOpts`) | MCP target |
|------|-----------------------------------|------------|
| Gate | `USER_AUTH_ENABLED` | Same |
| Header | `Authorization: Bearer <token>` | Same on HTTP; env on stdio |
| JWT valid | `authMode=user`, scope docs | `McpAuthMode=user`, compute `allowedDocumentIds` |
| API_KEY match | `authMode=service`, global | `McpAuthMode=service`, global |
| Neither | 401 | 401 HTTP / exit(1) stdio |
| Auth off | `apiRouteOpts` API_KEY only or open | `authMode=global` |

## Cursor MCP HTTP Auth

Cursor supports remote MCP with headers in `.mcp.json` / `mcp.json`:

```json
{
  "mcpServers": {
    "kb": {
      "url": "http://127.0.0.1:3100/mcp",
      "headers": {
        "Authorization": "Bearer <jwt-or-api-key>"
      }
    }
  }
}
```

Headers are sent on **each** HTTP request — aligns with PLAT-05 per-request validation.

## stdio Token Delivery

| Option | Pros | Cons |
|--------|------|------|
| **`MCP_USER_TOKEN` env** | Works with Cursor `env` block in mcp.json | One user per process |
| stdin prompt | Interactive | Breaks MCP protocol |
| Per-tool argument | No env | Leaks token in tool args; bad UX |

**Decision:** `MCP_USER_TOKEN` env (D-15). Document in Phase 18.

Cursor stdio example (Phase 18 docs):

```json
{
  "mcpServers": {
    "kb": {
      "command": "pnpm",
      "args": ["--filter", "@kb/mcp-server", "dev:stdio"],
      "env": { "MCP_USER_TOKEN": "<jwt>" }
    }
  }
}
```

## AsyncLocalStorage for Request Context

MCP SDK invokes tool handlers inside `transport.handleRequest`. Express handler can wrap:

```typescript
await mcpCallerStorage.run(callerContext, () =>
  transport.handleRequest(req, res, req.body),
);
```

Phase 17 `buildMcpServer` handlers call `getMcpCallerContext()` without signature changes to SDK.

| Alternative | Why rejected |
|-------------|--------------|
| Closure per session at init | Token must be re-validated each request (PLAT-05) |
| Global mutable variable | Race across concurrent HTTP sessions |
| Pass context into `buildMcpServer` at init only | Stale token if client rotates JWT |

## Shared `resolveBearerToken` Extraction

**Location:** `packages/auth/src/bearer-resolver.ts`

```typescript
export type BearerAuthMode = "user" | "service" | "none";

export interface BearerAuthResult {
  mode: BearerAuthMode;
  user?: AuthUser;
}

export async function resolveBearerToken(
  token: string | undefined,
  deps: {
    userAuthEnabled: boolean;
    authEnabled: boolean;
    apiKey?: string;
    authProvider: AuthProvider | null;
  },
): Promise<BearerAuthResult>
```

| `userAuthEnabled` | `token` | Result |
|-------------------|---------|--------|
| false | any | `{ mode: "none" }` |
| true | missing | throw `BearerAuthError` 401 |
| true | valid JWT | `{ mode: "user", user }` |
| true | API_KEY | `{ mode: "service" }` |
| true | invalid | throw 401 |

Backend maps `mode: "none"` → existing `apiRouteOpts` behavior when `USER_AUTH_ENABLED=false`.

## Test Strategy

| Layer | Coverage |
|-------|----------|
| `@kb/auth` | `resolveBearerToken` unit tests — JWT, API_KEY, missing, invalid |
| `mcp-auth-resolver` | Maps bearer result → `McpCallerContext` with mocked registry |
| `http.test.ts` | 401 without Bearer when `USER_AUTH_ENABLED`; 200 initialize with mock JWT |
| `stdio.test.ts` | Exits when auth enabled and no `MCP_USER_TOKEN` (spawn or mock) |

## Risks

| Risk | Mitigation |
|------|------------|
| Backend auth refactor regression | Keep same 401 messages; run `pnpm --filter @kb/backend test` |
| Concurrent sessions overwrite ALS | `storage.run` per request — isolated async context |
| stdio multi-user impossible | Documented limitation; HTTP for multi-user |
| `systemUserId` null when auth misconfigured | `createMcpServices` throws if `USER_AUTH_ENABLED` without system user |
