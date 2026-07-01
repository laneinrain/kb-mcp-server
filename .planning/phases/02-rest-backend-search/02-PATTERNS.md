# Phase 2: REST Backend & Search - Pattern Map

**Mapped:** 2026-07-01
**Files analyzed:** 12 new/modified files
**Analogs found:** 11 / 12

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/search/search-service.ts` | service | transform (embed → query → format) | `packages/core/src/ingestion/ingestion-service.ts` | exact |
| `packages/core/src/search/types.ts` | model | transform | `packages/core/src/ingestion/ingestion-service.ts` (IngestOptions/Result) | exact |
| `packages/core/src/search/search-service.test.ts` | test | — | `packages/core/src/ingestion/ingestion-service.test.ts` | exact |
| `packages/core/src/vector-store/chroma-store.ts` (add `query`) | service | CRUD (read/query) | `packages/core/src/vector-store/chroma-store.ts` (upsert/delete) | exact |
| `packages/core/src/vector-store/chroma-store.test.ts` (extend) | test | — | `packages/core/src/vector-store/chroma-store.test.ts` | exact |
| `packages/core/src/index.ts` (exports) | config/barrel | — | `packages/core/src/index.ts` | exact |
| `apps/backend/src/routes/documents.ts` | route | CRUD + file-I/O | `apps/backend/src/routes/health.ts` + `scripts/ingest.ts` | exact |
| `apps/backend/src/routes/search.ts` | route | request-response | `apps/backend/src/routes/health.ts` | role-match |
| `apps/backend/src/index.ts` (bootstrap) | config | request-response | `apps/backend/src/index.ts` + `scripts/ingest.ts` | exact |
| `apps/backend/src/routes/documents.test.ts` | test | — | No backend tests yet — use `@kb/core` vitest patterns | partial |
| `apps/backend/vitest.config.ts` | config | — | `packages/core/vitest.config.ts` | exact |
| `apps/backend/package.json` (deps) | config | — | `packages/core/package.json` | role-match |

## Pattern Assignments

### `packages/core/src/search/search-service.ts` (service, transform)

**Analog:** `packages/core/src/ingestion/ingestion-service.ts` (orchestration) + `packages/core/src/embeddings/embedding-client.ts` (query embed)

**Imports pattern** (ingestion-service lines 1-9):
```typescript
import { DEFAULT_COLLECTION, type AppConfig } from "@kb/config";
import { EmbeddingClient } from "../embeddings/embedding-client.js";
import { ChromaVectorStore } from "../vector-store/chroma-store.js";
import type { SearchOptions, SearchResult } from "./types.js";
```

**Class + factory pattern** (ingestion-service lines 43-65):
```typescript
export class SearchService {
  constructor(
    private readonly vectorStore: ChromaVectorStore,
    private readonly embeddingClient: EmbeddingClient,
    private readonly defaultCollection: string = DEFAULT_COLLECTION,
  ) {}

  static create(config: AppConfig, deps: {
    vectorStore: ChromaVectorStore;
    embeddingClient: EmbeddingClient;
  }): SearchService {
    return new SearchService(
      deps.vectorStore,
      deps.embeddingClient,
      config.DEFAULT_COLLECTION,
    );
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const collection = options?.collection ?? this.defaultCollection;
    const topK = Math.min(options?.topK ?? 5, 10);
    const embedding = await this.embeddingClient.embedQuery(query);
    const raw = await this.vectorStore.query({ embedding, topK, collection });
    // map distances → score, truncate text ~500 chars, attach documentId/filename/chunkIndex
    return raw.map(/* ... */);
  }
}
```

**Core orchestration pattern** (ingestion-service lines 67-110 — mirror pipeline steps):
```typescript
// IngestionService: parse → chunk → embedDocuments → upsertChunks → registry update
// SearchService:   embedQuery → vectorStore.query → format results (no registry write)
const embedding = await this.embeddingClient.embedQuery(query);
const results = await this.vectorStore.query({
  embedding,
  topK,
  collection,
});
```

**Query embed — do NOT duplicate prefix logic** (embedding-client lines 39-60):
```typescript
async embedQuery(text: string): Promise<number[]> {
  const [embedding] = await this.embedDocuments([this.formatQuery(text)]);
  return embedding;
}
```

---

### `packages/core/src/search/types.ts` (model, transform)

**Analog:** `packages/core/src/ingestion/ingestion-service.ts` (IngestOptions/IngestResult)

**Options/Result interfaces** (ingestion-service lines 11-19):
```typescript
export interface SearchOptions {
  collection?: string;
  topK?: number;
}

export interface SearchResult {
  score: number;
  text: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
}
```

**Naming:** PascalCase interfaces, camelCase fields, optional params via `?`. Export types from `index.ts` with `export type { ... }`.

---

### `packages/core/src/search/search-service.test.ts` (test)

**Analog:** `packages/core/src/ingestion/ingestion-service.test.ts`

**Imports + mock setup** (ingestion-service.test lines 1-18):
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SearchService } from "./search-service.js";

describe("SearchService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("search() calls embedQuery → vectorStore.query in order", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1, 0.2]);
    const query = vi.fn().mockResolvedValue([
      {
        documentId: "abc",
        filename: "doc.txt",
        chunkIndex: 0,
        text: "snippet",
        distance: 0.15,
      },
    ]);
    const service = new SearchService(
      { query } as never,
      { embedQuery } as never,
      "default",
    );

    const results = await service.search("what is RAG?");

    expect(embedQuery).toHaveBeenCalledWith("what is RAG?");
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 5, collection: "default" }),
    );
    expect(results[0].documentId).toBe("abc");
  });
});
```

**Behavior tests to cover:**
- Default `topK = 5`, hard max `10`
- Collection option forwarded to `vectorStore.query`
- Score derived from Chroma distance (cosine space per collection metadata)
- Text truncated to ~500 chars

---

### `packages/core/src/vector-store/chroma-store.ts` — add `query()` (service, CRUD read)

**Analog:** Same file — `upsertChunks` (lines 72-95) and `deleteByDocumentId` (lines 97-103)

**New interface** (mirror UpsertChunksParams lines 13-19):
```typescript
export interface QueryParams {
  embedding: number[];
  topK: number;
  collection?: string;
}

export interface QueryHit {
  documentId: string;
  filename: string;
  chunkIndex: number;
  text: string;
  distance: number;
}
```

**Core query pattern** (extend upsert/delete structure):
```typescript
async query(params: QueryParams): Promise<QueryHit[]> {
  const { embedding, topK, collection } = params;
  const col = await this.getOrCreateCollection(collection);

  const result = await col.query({
    queryEmbeddings: [embedding],
    nResults: topK,
    include: ["documents", "metadatas", "distances"],
  });

  const ids = result.ids[0] ?? [];
  const documents = result.documents[0] ?? [];
  const metadatas = result.metadatas[0] ?? [];
  const distances = result.distances[0] ?? [];

  return ids.map((_, i) => ({
    documentId: String(metadatas[i]?.document_id ?? ""),
    filename: String(metadatas[i]?.filename ?? ""),
    chunkIndex: Number(metadatas[i]?.chunk_index ?? 0),
    text: documents[i] ?? "",
    distance: distances[i] ?? 0,
  }));
}
```

**Metadata contract — reuse upsert fields** (chroma-store lines 81-85):
```typescript
const metadatas = chunks.map((_, index) => ({
  document_id: documentId,
  filename,
  chunk_index: index,
}));
```

**Collection access pattern** (lines 52-70, 79, 101):
```typescript
const col = await this.getOrCreateCollection(collection);
// embeddingFunction: null — we always supply queryEmbeddings, never queryTexts
```

---

### `packages/core/src/vector-store/chroma-store.test.ts` (extend)

**Analog:** Existing delete/upsert tests (lines 45-76)

**Mock collection.query test** (mirror deleteByDocumentId test):
```typescript
it("query calls collection.query with queryEmbeddings and nResults", async () => {
  const queryMock = vi.fn().mockResolvedValue({
    ids: [["doc:0"]],
    documents: [["hello world"]],
    metadatas: [[{ document_id: "doc", filename: "f.txt", chunk_index: 0 }]],
    distances: [[0.12]],
  });
  const collection = { query: queryMock } as unknown as Collection;
  const getOrCreateCollection = vi.fn().mockResolvedValue(collection);
  const store = new ChromaVectorStore(makeConfig(), {
    heartbeat: vi.fn(),
    getOrCreateCollection,
  } as never);

  const hits = await store.query({
    embedding: [0.1, 0.2],
    topK: 5,
  });

  expect(queryMock).toHaveBeenCalledWith(
    expect.objectContaining({
      queryEmbeddings: [[0.1, 0.2]],
      nResults: 5,
      include: expect.arrayContaining(["documents", "metadatas", "distances"]),
    }),
  );
  expect(hits[0].documentId).toBe("doc");
});
```

Reuse inline `makeConfig()` object from embedding-client.test.ts (lines 6-22) or extract shared test helper.

---

### `packages/core/src/index.ts` (barrel exports)

**Analog:** Current `packages/core/src/index.ts`

**Export pattern** (lines 17-37):
```typescript
export { SearchService } from "./search/search-service.js";
export type { SearchOptions, SearchResult } from "./search/types.js";
export {
  ChromaVectorStore,
  buildChunkId,
  type UpsertChunksParams,
  type QueryParams,
  type QueryHit,
} from "./vector-store/chroma-store.js";
```

**Conventions:**
- Named class exports: `export { ClassName } from "./path.js"`
- Type-only exports: `export type { Interface } from "./path.js"`
- Re-export related types from the same module as the class
- `.js` extension in all relative import paths (NodeNext ESM)
- New domain folder: `search/` (parallel to `ingestion/`, `embeddings/`, `vector-store/`)

---

### `apps/backend/src/routes/documents.ts` (route, CRUD + file-I/O)

**Analog:** `apps/backend/src/routes/health.ts` (route registration) + `scripts/ingest.ts` (service wiring)

**Route registration pattern** (health.ts lines 1-14):
```typescript
import type { FastifyInstance } from "fastify";
import type { IngestionService } from "@kb/core";
import type { DocumentRegistry } from "@kb/core";
import type { ChromaVectorStore } from "@kb/core";

export interface DocumentsDeps {
  ingestionService: IngestionService;
  registry: DocumentRegistry;
  vectorStore: ChromaVectorStore;
  uploadsDir: string; // config.DATA_DIR + "/uploads"
}

export async function registerDocumentRoutes(
  app: FastifyInstance,
  deps: DocumentsDeps,
): Promise<void> {
  // routes under /api/v1/documents
}
```

**Error handling pattern** (health.ts lines 17-27):
```typescript
app.get("/health/chroma", async (_request, reply) => {
  try {
    await deps.vectorStore.heartbeat();
    return { status: "ok" };
  } catch (error) {
    reply.code(503);
    return {
      status: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
});
```

**Service wiring from CLI** (ingest.ts lines 46-59):
```typescript
const config = loadConfig();
const settingsStore = initSettingsStore(config);
const registry = getDocumentRegistry(settingsStore.db);
const vectorStore = new ChromaVectorStore(config);
const embeddingClient = new EmbeddingClient(config);
const ingestionService = IngestionService.create(config, {
  registry,
  vectorStore,
  embeddingClient,
  settingsStore,
});
```

**Upload flow (D-08, D-10):**
1. `@fastify/multipart` — save file to `DATA_DIR/uploads/` temp path
2. Call `ingestionService.ingest(tempPath, { collection })`
3. Return `201` with `{ documentId, chunkCount, collection, status: "indexed" }`
4. Map parser errors (e.g. `INSUFFICIENT_TEXT_ERROR`) to `4xx`

**List pattern** (document-registry lines 124-127):
```typescript
const docs = deps.registry.listDocuments();
return docs.map(({ sourcePath, ...rest }) => rest); // omit sourcePath from API
```

**Delete pattern** (document-registry lines 129-131 + chroma-store lines 97-103):
```typescript
const doc = deps.registry.getDocument(documentId);
if (!doc) {
  reply.code(404);
  return { error: "not_found", message: `Document ${documentId} not found` };
}
await deps.vectorStore.deleteByDocumentId(documentId, doc.collection);
deps.registry.deleteDocument(documentId);
return { status: "deleted", documentId };
```

**Route prefix:** `/api/v1/documents` (health stays at `/health*` per D-20)

---

### `apps/backend/src/routes/search.ts` (route, request-response)

**Analog:** `apps/backend/src/routes/health.ts`

**Route registration + deps** (health.ts lines 6-14):
```typescript
import type { FastifyInstance } from "fastify";
import type { SearchService } from "@kb/core";

export interface SearchDeps {
  searchService: SearchService;
}

export async function registerSearchRoutes(
  app: FastifyInstance,
  deps: SearchDeps,
): Promise<void> {
  app.post("/api/v1/search", async (request, reply) => {
    try {
      const { query, topK, collection } = request.body as {
        query: string;
        topK?: number;
        collection?: string;
      };
      const results = await deps.searchService.search(query, { topK, collection });
      return { results };
    } catch (error) {
      reply.code(500);
      return {
        error: "search_failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
```

**Validation (D-22):** Define Zod schemas co-located in route file; register via `fastify-type-provider-zod` in bootstrap. Follow `@kb/config` Zod style (env.ts lines 27-48).

---

### `apps/backend/src/index.ts` (bootstrap)

**Analog:** `apps/backend/src/index.ts` (lines 1-29) + `scripts/ingest.ts` (deps)

**Bootstrap pattern** (index.ts lines 10-23):
```typescript
import Fastify from "fastify";
import { loadConfig } from "@kb/config";
import {
  ChromaVectorStore,
  EmbeddingClient,
  IngestionService,
  SearchService,
  getDocumentRegistry,
  initSettingsStore,
} from "@kb/core";
import { registerHealthRoutes } from "./routes/health.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerSearchRoutes } from "./routes/search.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const settingsStore = initSettingsStore(config);
  const registry = getDocumentRegistry(settingsStore.db);
  const vectorStore = new ChromaVectorStore(config);
  const embeddingClient = new EmbeddingClient(config);

  const ingestionService = IngestionService.create(config, {
    registry, vectorStore, embeddingClient, settingsStore,
  });
  const searchService = SearchService.create(config, {
    vectorStore, embeddingClient,
  });

  const app = Fastify({ logger: true });
  // register swagger, multipart, zod type provider plugins here
  await registerHealthRoutes(app, { vectorStore, embeddingClient });
  await registerDocumentRoutes(app, {
    ingestionService, registry, vectorStore,
    uploadsDir: `${config.DATA_DIR}/uploads`,
  });
  await registerSearchRoutes(app, { searchService });

  await app.listen({ host: config.BACKEND_HOST, port: config.BACKEND_PORT });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

**Import convention:** Relative routes use `.js` suffix (`./routes/health.js`). Workspace packages use bare imports (`@kb/core`, `@kb/config`).

---

### `apps/backend/vitest.config.ts` + route tests

**Analog:** `packages/core/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
```

Add `"test": "vitest run"` script to `apps/backend/package.json` (mirror `packages/core/package.json` line 17).

**No existing backend route tests** — use Fastify `app.inject()` with mocked `@kb/core` services (same vi.fn mock style as ingestion-service.test.ts).

---

## Shared Patterns

### Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Source files | kebab-case | `search-service.ts`, `embedding-client.ts` |
| Classes | PascalCase | `SearchService`, `ChromaVectorStore` |
| Interfaces | PascalCase | `SearchOptions`, `DocumentsDeps` |
| Functions | camelCase | `registerDocumentRoutes`, `buildChunkId` |
| Route registrars | `registerXxxRoutes` | `registerHealthRoutes`, `registerSearchRoutes` |
| Deps interfaces | `XxxDeps` | `HealthDeps`, `SearchDeps` |
| Factory methods | `static create(config, deps)` | `IngestionService.create`, `SearchService.create` |
| Test files | co-located `*.test.ts` | `search-service.test.ts` |
| Import paths | `.js` extension on relative imports | `from "./search-service.js"` |

### Config & Bootstrap

**Source:** `scripts/ingest.ts` + `apps/backend/src/index.ts`

All apps load config once via `loadConfig()` from `@kb/config`. Core services receive `AppConfig` through `static create()` factories. Never instantiate Chroma or embedding clients inside route handlers.

```typescript
const config = loadConfig();
const settingsStore = initSettingsStore(config);
const registry = getDocumentRegistry(settingsStore.db);
const vectorStore = new ChromaVectorStore(config);
const embeddingClient = new EmbeddingClient(config);
```

### Dependency Injection (Routes)

**Source:** `apps/backend/src/routes/health.ts`

Routes receive dependencies via typed `XxxDeps` interface + `registerXxxRoutes(app, deps)`. Routes stay thin — delegate to `@kb/core` services. No direct Chroma or OpenAI calls in route modules.

### Error Handling

**Source:** `apps/backend/src/routes/health.ts` (lines 17-27, 30-41)

```typescript
try {
  // service call
  return { /* success body */ };
} catch (error) {
  reply.code(503); // or 4xx/5xx as appropriate
  return {
    status: "error", // or error: "code"
    message: error instanceof Error ? error.message : String(error),
  };
}
```

API error shape per D-12: `{ error, message }`. Map `404` for missing documents, `400` for validation/parser failures, `503` for dependency outages.

### Validation (Zod)

**Source:** `packages/config/src/env.ts` (lines 27-48)

```typescript
import { z } from "zod";

const searchBodySchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(10).optional(),
  collection: z.string().optional(),
});
```

Use `fastify-type-provider-zod` in backend bootstrap. Schemas live in route modules (D-22).

### Vitest (Per Package)

**Source:** `packages/core/vitest.config.ts`, `packages/core/src/ingestion/ingestion-service.test.ts`

- Each package with tests gets its own `vitest.config.ts` with `include: ["src/**/*.test.ts"]`
- Root `vitest.config.ts` uses workspace projects
- Imports: `import { describe, expect, it, vi, beforeEach } from "vitest"`
- Mock dependencies with `vi.fn()` and `as never` casts for partial mocks
- `beforeEach(() => vi.clearAllMocks())` in multi-test suites
- `makeConfig()` helper returns full `AppConfig` object (see embedding-client.test.ts lines 6-22)
- Optional live tests: `it.skipIf(!process.env.CHERRYIN_API_KEY)(...)`
- Node environment comment for integration: `// @vitest-environment node`

### Export from `@kb/core` index.ts

**Source:** `packages/core/src/index.ts`

```typescript
// Classes
export { SearchService } from "./search/search-service.js";

// Types (separate export type line)
export type { SearchOptions, SearchResult } from "./search/types.js";

// Extended vector store types
export {
  ChromaVectorStore,
  buildChunkId,
  type UpsertChunksParams,
  type QueryParams,
  type QueryHit,
} from "./vector-store/chroma-store.js";
```

Group exports by domain area (registry → embeddings → vector-store → ingestion → search). Always export associated types alongside their service class.

### Chroma Explicit Embeddings Contract

**Source:** `packages/core/src/vector-store/chroma-store.ts` + `.planning/research/PITFALLS.md`

- Write path: `col.upsert({ ids, embeddings, documents, metadatas })` — never omit `embeddings`
- Read path: `col.query({ queryEmbeddings, nResults, include })` — never pass raw query text
- Collection created with `embeddingFunction: null` (lines 59-66)
- Metadata fields: `document_id`, `filename`, `chunk_index` — query results map back via metadatas

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/backend/src/routes/documents.test.ts` | test | request-response | No backend route tests exist yet; use Fastify `inject()` + RESEARCH.md Fastify/zod patterns |
| Zod route schemas in backend | validation | request-response | Zod used only in `@kb/config` env today; follow env.ts + STACK.md `fastify-type-provider-zod` guidance |
| `@fastify/multipart` upload handler | middleware | file-I/O | No multipart usage in codebase; STACK.md documents `@fastify/multipart@9.1.3` |
| `@fastify/swagger` setup | config | — | No swagger in codebase; STACK.md documents plugin registration order |

## Metadata

**Analog search scope:** `packages/core/src/**`, `apps/backend/src/**`, `scripts/ingest.ts`, `.planning/research/`
**Files scanned:** 18 source + test files
**Pattern extraction date:** 2026-07-01
