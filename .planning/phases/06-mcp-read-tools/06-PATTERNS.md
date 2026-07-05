# Phase 6: MCP Read Tools - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 8 target files
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/mcp-server/src/services.ts` | config | — | `apps/backend/src/services.ts` (ContextService wiring subset) | exact |
| `apps/mcp-server/src/server.ts` | route/tool | request-response | `apps/mcp-server/src/server.ts` (`search_knowledge` handler) | exact |
| `apps/mcp-server/src/server.test.ts` | test | — | `apps/mcp-server/src/server.test.ts` | exact |
| `apps/mcp-server/src/stdio.ts` | config | request-response | `apps/mcp-server/src/stdio.ts` | exact |
| `apps/mcp-server/src/http.ts` | route | request-response | `apps/mcp-server/src/http.ts` | exact |
| `apps/mcp-server/src/http.test.ts` | test | — | `apps/mcp-server/src/http.test.ts` | exact |
| `scripts/uat-read-around.ts` | test/uat | request-response | `scripts/uat-search-knowledge.ts` | exact |
| `package.json` (root script) | config | — | `scripts/uat-search-knowledge.ts` entry in root package.json | partial |

## Pattern Assignments

### `apps/mcp-server/src/services.ts` — extend McpServices

**Analog:** `apps/backend/src/services.ts` lines 29-52 (context subset without ingestion/embedding for reads)

```typescript
import {
  ChromaVectorStore,
  ContextService,
  EmbeddingClient,
  getDocumentRegistry,
  initSettingsStore,
  SearchService,
} from "@kb/core";

export interface McpServices {
  config: AppConfig;
  searchService: SearchService;
  contextService: ContextService;
}

export async function createMcpServices(): Promise<McpServices> {
  const config = loadConfig();
  const settingsStore = initSettingsStore(config);
  const registry = getDocumentRegistry(settingsStore.db);
  const vectorStore = new ChromaVectorStore(config);
  const embeddingClient = new EmbeddingClient(config);
  const searchService = SearchService.create(config, { vectorStore, embeddingClient });
  const contextService = ContextService.create(config, { registry, vectorStore, settingsStore });
  return { config, searchService, contextService };
}
```

**Key:** Same `initSettingsStore(config)` → shared SQLite path as backend (Phase 6 D-09).

### `apps/mcp-server/src/server.ts` — register read tools

**Analog:** existing `search_knowledge` registration (lines 16-44)

**Signature change:**
```typescript
export function buildMcpServer(
  searchService: SearchService,
  contextService: ContextService,
): McpServer
```

**read_around handler pattern:**
```typescript
server.registerTool("read_around", { description, inputSchema }, async ({ document_id, chunk_index, window, collection }) => {
  try {
    const result = await contextService.readAround(document_id, chunk_index, { window, collection });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "read_around failed";
    return { content: [{ type: "text", text: message }], isError: true };
  }
});
```

**Zod schema (snake_case at boundary, D-06):**
```typescript
const readAroundInputSchema = {
  document_id: z.string().min(1),
  chunk_index: z.number().int().min(0),
  window: z.number().int().min(0).max(10).optional(),
  collection: z.string().optional(),
};
```

**Description (D-01, D-02):** One English sentence + inline example referencing search hit fields.

**ContextError:** Use `instanceof ContextError` import from `@kb/core`; message-only isError (D-08).

### Transport entrypoints

**stdio.ts / http.ts:** Destructure `{ searchService, contextService }` from `createMcpServices()`; call `buildMcpServer(searchService, contextService)`.

**http.ts line 44** currently `buildMcpServer(searchService)` — update to pass both services.

### Tests

**server.test.ts:** Extend `connectTestClient` mock to include `contextService` with mocked `readAround`/`readFile`. Assert `listTools` returns exactly 3 tools. Assert forbidden write tools still absent.

**http.test.ts:** After initialize session, `tools/list` must include `read_around` and `read_file` with same names as stdio.

### UAT

**Analog:** `scripts/uat-search-knowledge.ts` — stdio client, call search then read_around with first hit's documentId/chunkIndex mapped to snake_case args.
