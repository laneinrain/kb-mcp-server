# Phase 3: MCP Search Server - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 8 source files + Phase 2 patterns
**Analogs found:** 7 / 8 planned files

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `apps/mcp-server/src/services.ts` | service bootstrap | request-response | `apps/backend/src/services.ts` | exact (search subset) |
| `apps/mcp-server/src/server.ts` | MCP tool registration | request-response | `apps/backend/src/routes/search.ts` | role-match |
| `apps/mcp-server/src/server.test.ts` | test | — | `apps/backend/src/routes/search.test.ts` | exact |
| `apps/mcp-server/src/stdio.ts` | entrypoint | transport | `apps/backend/src/index.ts` (main bootstrap) | role-match |
| `apps/mcp-server/src/http.ts` | entrypoint | transport | SDK `simpleStreamableHttp.ts` | external analog |
| `apps/mcp-server/src/http.test.ts` | test | — | `apps/backend/src/routes/search.test.ts` | partial |
| `apps/mcp-server/package.json` | config | — | `apps/backend/package.json` | exact |
| `packages/config/src/env.ts` (extend) | config | — | existing env schema | exact |

## Pattern Assignments

### `apps/mcp-server/src/services.ts` (bootstrap)

**Analog:** `apps/backend/src/services.ts` (lines 25-55)

**Search-only subset:**
```typescript
import { loadConfig, type AppConfig } from "@kb/config";
import {
  ChromaVectorStore,
  EmbeddingClient,
  SearchService,
} from "@kb/core";

export interface McpServices {
  config: AppConfig;
  searchService: SearchService;
}

export async function createMcpServices(): Promise<McpServices> {
  const config = loadConfig();
  const vectorStore = new ChromaVectorStore(config);
  const embeddingClient = new EmbeddingClient(config);
  const searchService = SearchService.create(config, {
    vectorStore,
    embeddingClient,
  });
  return { config, searchService };
}
```

**Omit:** registry, IngestionService, uploadsDir — MCP is retrieval-only per D-32.

---

### `apps/mcp-server/src/server.ts` (buildMcpServer)

**Analog:** `apps/backend/src/routes/search.ts` (delegation pattern)

**REST search route** (search.ts lines 43-49):
```typescript
const results = await deps.searchService.search(request.body.query, {
  topK: request.body.topK,
  collection: request.body.collection,
});
return { results };
```

**MCP tool equivalent:**
```typescript
export function buildMcpServer(searchService: SearchService): McpServer {
  const server = new McpServer({ name: "kb-mcp-server", version: "0.1.0" });
  server.registerTool("search_knowledge", { inputSchema: { ... } }, async (input) => {
    const results = await searchService.search(input.query, {
      topK: input.top_k,
      collection: input.collection,
    });
    return { content: [{ type: "text", text: JSON.stringify({ results }) }], structuredContent: { results } };
  });
  return server;
}
```

**Naming:** snake_case `top_k` at MCP boundary; camelCase `topK` at SearchService boundary (D-26).

**Must not import:** ChromaVectorStore, EmbeddingClient in server.ts — SearchService only (parity with search.ts grep gate).

---

### `apps/mcp-server/src/server.test.ts` (unit tests)

**Analog:** `apps/backend/src/routes/search.test.ts`

**Mock pattern** (from search-service.test.ts):
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { buildMcpServer } from "./server.js";

describe("buildMcpServer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("search_knowledge delegates to SearchService.search", async () => {
    const search = vi.fn().mockResolvedValue([
      { score: 0.9, text: "snippet", documentId: "d1", filename: "a.txt", chunkIndex: 0 },
    ]);
    const server = buildMcpServer({ search: search.bind(null) } as never);
    // invoke tool handler via SDK listTools/callTool or extract handler for direct test
    expect(search).toHaveBeenCalledWith("test query", expect.objectContaining({ topK: 5 }));
  });
});
```

**Behavior tests:**
- Only `search_knowledge` tool registered (MCP-05)
- top_k mapped to topK
- Empty query rejected by Zod
- No ingest/upload/delete tool names in registerTool calls

---

### `apps/mcp-server/src/stdio.ts` (stdio entrypoint)

**Analog:** `apps/backend/src/index.ts` main() + MCP SDK stdio example

**Bootstrap pattern** (backend index.ts):
```typescript
async function main(): Promise<void> {
  const services = await createMcpServices();
  const server = buildMcpServer(services.searchService);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

**stderr-only:** Use `console.error` for startup message — never `console.log` (D-30).

---

### `apps/mcp-server/src/http.ts` (Streamable HTTP entrypoint)

**Analog:** MCP SDK `simpleStreamableHttp.ts` (external)

**Config bind** (backend index.ts listen pattern):
```typescript
app.listen({ host: config.MCP_HTTP_HOST, port: config.MCP_HTTP_PORT }, () => {
  console.error(`MCP HTTP listening on http://${config.MCP_HTTP_HOST}:${config.MCP_HTTP_PORT}/mcp`);
});
```

**Shared factory:** Call `buildMcpServer(searchService)` on new session init — same tool set as stdio (D-24).

---

### `packages/config/src/env.ts` (extend)

**Analog:** existing `BACKEND_HOST` / `BACKEND_PORT` fields (lines 43-44)

```typescript
MCP_HTTP_HOST: z.string().default("127.0.0.1"),
MCP_HTTP_PORT: z.coerce.number().default(3100),
```

Update `.env.example` with commented MCP section.

---

### `apps/mcp-server/package.json`

**Analog:** `apps/backend/package.json`

```json
{
  "name": "@kb/mcp-server",
  "type": "module",
  "bin": {
    "kb-mcp-server": "./dist/stdio.js"
  },
  "scripts": {
    "dev": "tsx watch src/http.ts",
    "dev:stdio": "tsx src/stdio.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@kb/config": "workspace:*",
    "@kb/core": "workspace:*",
    "@modelcontextprotocol/sdk": "1.29.0",
    "express": "^5.1.0",
    "zod": "^4.4.3"
  }
}
```

---

## Shared Patterns

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| MCP tool name | snake_case | `search_knowledge` |
| Tool param (MCP) | snake_case | `top_k` |
| SearchService param | camelCase | `topK` |
| Factory functions | `createXxxServices`, `buildMcpServer` | per D-24, D-32 |
| Entry files | transport name | `stdio.ts`, `http.ts` |
| Import paths | `.js` suffix on relative | `from "./server.js"` |

### Config & Bootstrap

**Source:** `apps/backend/src/services.ts`, `scripts/ingest.ts`

Single `loadConfig()` at startup. MCP app constructs Chroma + Embedding + SearchService once; passes SearchService to `buildMcpServer()`.

### Dependency Injection

**Source:** `apps/backend/src/routes/search.ts`

Tool handler receives SearchService via closure in `buildMcpServer(searchService)` — no global singletons.

### Error Handling

**Source:** MCP SDK tool handler pattern

Return `{ content: [{ type: "text", text: error message }], isError: true }` on search failures — do not throw unhandled (stdio stability).

### Vitest

**Source:** `apps/backend/vitest.config.ts`

Co-located `*.test.ts`, `vi.fn()` mocks, `pnpm --filter @kb/mcp-server test`.

## No Analog Found

| File | Reason |
|------|--------|
| `apps/mcp-server/src/http.test.ts` | No MCP HTTP tests in repo; use supertest against express app with mocked SearchService |
| MCP SDK registerTool invocation in tests | May use Client SDK or test handler extraction — follow SDK test patterns at implementation |

## Metadata

**Analog search scope:** `apps/backend/src/**`, `packages/core/src/search/**`, `packages/config/src/**`, MCP SDK docs
**Pattern extraction date:** 2026-07-01
