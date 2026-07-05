# Phase 5: Context Retrieval Core - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 18 new/modified files
**Analogs found:** 16 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/context/context-service.ts` | service | transform (registry → chroma get → window/range) | `packages/core/src/search/search-service.ts` | exact |
| `packages/core/src/context/types.ts` | model | transform | `packages/core/src/search/types.ts` | exact |
| `packages/core/src/context/context-service.test.ts` | test | — | `packages/core/src/search/search-service.test.ts` | exact |
| `packages/core/src/vector-store/chroma-store.ts` (add `getByIds`) | service | CRUD (read by ID) | `packages/core/src/vector-store/chroma-store.ts` (`query`, `upsertChunks`) | exact |
| `packages/core/src/vector-store/chroma-store.test.ts` (extend) | test | — | `packages/core/src/vector-store/chroma-store.test.ts` | exact |
| `packages/core/src/registry/settings-store.ts` (extend) | service | CRUD (read settings) | `packages/core/src/registry/settings-store.ts` | exact |
| `packages/core/src/registry/schema.sql` (extend) | migration | — | `packages/core/src/registry/schema.sql` | exact |
| `packages/core/src/registry/types.ts` (add `ContextConfig`) | model | — | `packages/core/src/registry/types.ts` (`ChunkConfig`) | exact |
| `packages/config/src/env.ts` (context defaults) | config | transform | `packages/config/src/env.ts` (`CHUNK_SIZE`, `CHUNK_OVERLAP`) | exact |
| `packages/core/src/index.ts` (exports) | config/barrel | — | `packages/core/src/index.ts` | exact |
| `apps/backend/src/routes/settings.ts` | route | CRUD (GET/PATCH) | `apps/backend/src/routes/search.ts` + `documents.ts` | exact |
| `apps/backend/src/routes/settings.test.ts` | test | — | `apps/backend/src/routes/search.test.ts` | exact |
| `apps/backend/src/lib/errors.ts` (add `mapContextError`) | utility | request-response | `apps/backend/src/lib/errors.ts` (`notFound`, `mapSearchError`) | exact |
| `apps/backend/src/services.ts` | config | — | `apps/backend/src/services.ts` | exact |
| `apps/backend/src/index.ts` | config | request-response | `apps/backend/src/index.ts` | exact |
| `apps/web/src/components/SettingsPanel.tsx` | component | request-response | `apps/web/src/components/SearchPanel.tsx` + `UploadPanel.tsx` | exact |
| `apps/web/src/api/settings.ts` | utility | CRUD | `apps/web/src/api/search.ts` | exact |
| `apps/web/src/App.tsx` + `AppShell.tsx` | component | request-response | `apps/web/src/App.tsx` + `AppShell.tsx` | exact |

## Pattern Assignments

### `packages/core/src/context/context-service.ts` (service, transform)

**Analog:** `packages/core/src/search/search-service.ts` (class + factory + collection default) + `packages/core/src/ingestion/ingestion-service.ts` (SettingsStore dependency)

**Imports pattern** (search-service lines 1-4; ingestion-service line 6):
```typescript
import { DEFAULT_COLLECTION, type AppConfig } from "@kb/config";
import type { ChromaVectorStore } from "../vector-store/chroma-store.js";
import type { DocumentRegistry } from "../registry/document-registry.js";
import type { SettingsStore } from "../registry/settings-store.js";
import type { ReadAroundOptions, ReadAroundResult, ReadFileResult } from "./types.js";
```

**Class + factory pattern** (search-service lines 22-41; ingestion-service lines 54-66):
```typescript
export class ContextService {
  constructor(
    private readonly registry: DocumentRegistry,
    private readonly vectorStore: ChromaVectorStore,
    private readonly settingsStore: SettingsStore,
    private readonly defaultCollection: string = DEFAULT_COLLECTION,
  ) {}

  static create(
    config: AppConfig,
    deps: {
      registry: DocumentRegistry;
      vectorStore: ChromaVectorStore;
      settingsStore: SettingsStore;
    },
  ): ContextService {
    return new ContextService(
      deps.registry,
      deps.vectorStore,
      deps.settingsStore,
      config.DEFAULT_COLLECTION,
    );
  }
}
```

**Live settings on each call** (ingestion-service lines 80-81; settings-store lines 46-51):
```typescript
async readAround(documentId: string, chunkIndex: number, options?: ReadAroundOptions) {
  const settings = this.settingsStore.getContextConfig(); // new method
  const windowRequested = options?.window ?? settings.readAroundWindowDefault;
  const windowApplied = Math.min(windowRequested, settings.readAroundWindowMax);
  const collection = options?.collection ?? this.defaultCollection;
  // ...
}
```

**Registry → Chroma fetch pipeline** (document-registry lines 146-149; chroma-store lines 9-11, 94):
```typescript
const doc = this.registry.getDocument(documentId);
if (!doc) {
  throw contextError("document_not_found", `Document ${documentId} not found`);
}

const chromaIds = this.registry.getChunkIds(documentId);
if (chunkIndex < 0 || chunkIndex >= chromaIds.length) {
  throw contextError("chunk_index_out_of_range", `Chunk index ${chunkIndex} out of range`);
}

const start = Math.max(0, chunkIndex - windowApplied);
const end = Math.min(chromaIds.length - 1, chunkIndex + windowApplied);
const idsToFetch = chromaIds.slice(start, end + 1);

const hits = await this.vectorStore.getByIds({
  ids: idsToFetch,
  collection,
});
// Sort by chunk_index ascending; mark center with is_center: true
// Apply read_around_max_chars truncation from far end of window
```

**Bounded clamping pattern** (search-service lines 47-48 — mirror for window, not error):
```typescript
const topK = Math.min(options?.topK ?? DEFAULT_TOP_K, MAX_TOP_K);
// ContextService equivalent:
const windowApplied = Math.min(windowRequested, settings.readAroundWindowMax);
// Silent clamp — include window_requested + window_applied in response metadata
```

**No snippet truncation** — ContextService returns full Chroma text (search-service lines 15-20, 57-63 are the inverse):
```typescript
// SearchService truncates to 500 chars — DO NOT copy truncateText here
return hits.map((hit) => ({
  documentId: hit.documentId,
  filename: hit.filename,
  chunkIndex: hit.chunkIndex,
  text: hit.text, // full stored text
  isCenter: hit.chunkIndex === chunkIndex,
}));
```

**Structured errors** (backend errors.ts lines 51-61 — mirror with `code` field for MCP Phase 6):
```typescript
export class ContextError extends Error {
  constructor(
    public readonly code: "document_not_found" | "chunk_index_out_of_range",
    message: string,
  ) {
    super(message);
    this.name = "ContextError";
  }
}

function contextError(code: ContextError["code"], message: string): ContextError {
  return new ContextError(code, message);
}
```

---

### `packages/core/src/context/types.ts` (model, transform)

**Analog:** `packages/core/src/search/types.ts`

**Options/Result interfaces** (search/types.ts lines 1-12):
```typescript
export interface ReadAroundOptions {
  collection?: string;
  window?: number;
}

export interface ContextChunk {
  documentId: string;
  filename: string;
  chunkIndex: number;
  text: string;
  isCenter?: boolean;
}

export interface ReadAroundResult {
  documentId: string;
  filename: string;
  collection: string;
  chunkRange: { start: number; end: number };
  windowRequested: number;
  windowApplied: number;
  truncated?: boolean;
  chunks: ContextChunk[];
}

export interface ReadFileResult {
  documentId: string;
  filename: string;
  collection: string;
  chunkCount: number;
  truncated?: boolean;
  chunks: ContextChunk[];
}
```

**Naming:** PascalCase interfaces, camelCase fields, optional params via `?`. Export from `packages/core/src/index.ts` with `export type { ... }`.

---

### `packages/core/src/context/context-service.test.ts` (test)

**Analog:** `packages/core/src/search/search-service.test.ts`

**Imports + mock setup** (search-service.test lines 1-7):
```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ContextService } from "./context-service.js";

describe("ContextService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
```

**Mock deps + call-order assertion** (search-service.test lines 9-33):
```typescript
it("readAround() calls registry.getChunkIds then vectorStore.getByIds", async () => {
  const getDocument = vi.fn().mockReturnValue({
    id: "doc-1",
    filename: "notes.txt",
    collection: "default",
  });
  const getChunkIds = vi.fn().mockReturnValue(["doc-1:0", "doc-1:1", "doc-1:2"]);
  const getByIds = vi.fn().mockResolvedValue([
    { documentId: "doc-1", filename: "notes.txt", chunkIndex: 1, text: "center" },
  ]);
  const getContextConfig = vi.fn().mockReturnValue({
    readAroundWindowDefault: 1,
    readAroundWindowMax: 3,
    readAroundMaxChars: 32000,
    readFileMaxChunks: 50,
    readFileMaxChars: 64000,
  });

  const service = new ContextService(
    { getDocument, getChunkIds } as never,
    { getByIds } as never,
    { getContextConfig } as never,
    "default",
  );

  await service.readAround("doc-1", 1);

  expect(getChunkIds).toHaveBeenCalledWith("doc-1");
  expect(getByIds).toHaveBeenCalledWith(
    expect.objectContaining({ collection: "default" }),
  );
});
```

**Clamp + boundary tests to add** (search-service.test lines 35-49 pattern):
```typescript
it("window above max is silently clamped", async () => { /* windowRequested=5 → windowApplied=3 */ });
it("at document start, chunk_range shrinks without error", async () => { /* center=0, window=2 */ });
it("unknown document_id throws ContextError with no partial chunks", async () => { /* ... */ });
it("ContextService.create factory mirrors SearchService.create", async () => { /* lines 114-127 */ });
```

---

### `packages/core/src/vector-store/chroma-store.ts` — add `getByIds` (service, CRUD read)

**Analog:** `query()` (lines 119-141) for metadata mapping + `upsertChunks()` (lines 86-108) for ID format

**New interface** (mirror QueryParams/QueryHit at lines 21-33):
```typescript
export interface GetByIdsParams {
  ids: string[];
  collection?: string;
}

export interface ChunkHit {
  documentId: string;
  filename: string;
  chunkIndex: number;
  text: string;
}
```

**Core get-by-ID pattern** (query lines 119-141 — swap `col.query` for `col.get`):
```typescript
async getByIds(params: GetByIdsParams): Promise<ChunkHit[]> {
  const { ids, collection } = params;
  if (ids.length === 0) {
    return [];
  }

  const col = await this.getOrCreateCollection(collection);

  const result = await col.get({
    ids,
    include: ["documents", "metadatas"],
  });

  const documents = result.documents ?? [];
  const metadatas = result.metadatas ?? [];

  return ids.map((id, index) => ({
    documentId: String(metadatas[index]?.document_id ?? ""),
    filename: String(metadatas[index]?.filename ?? ""),
    chunkIndex: Number(metadatas[index]?.chunk_index ?? 0),
    text: documents[index] ?? "",
  }));
}
```

**ID convention** (lines 9-11, 94):
```typescript
export function buildChunkId(documentId: string, chunkIndex: number): string {
  return `${documentId}:${chunkIndex}`;
}
// upsert: ids = chunks.map((_, index) => buildChunkId(documentId, index));
```

**Collection passthrough** (query lines 139-141 test pattern in chroma-store.test.ts lines 139-181):
```typescript
const col = await this.getOrCreateCollection(collection);
```

---

### `packages/core/src/vector-store/chroma-store.test.ts` (extend)

**Analog:** Existing `query()` test (lines 84-137)

**Mock collection.get + metadata mapping**:
```typescript
it("getByIds() calls collection.get with ids and maps metadata", async () => {
  const getMock = vi.fn().mockResolvedValue({
    ids: ["doc-1:0", "doc-1:1"],
    documents: ["hello", "world"],
    metadatas: [
      { document_id: "doc-1", filename: "sample.txt", chunk_index: 0 },
      { document_id: "doc-1", filename: "sample.txt", chunk_index: 1 },
    ],
  });
  const collection = { get: getMock } as unknown as Collection;
  const getOrCreateCollection = vi.fn().mockResolvedValue(collection);
  // ... construct store with mock client (lines 93-116 pattern)

  const hits = await store.getByIds({ ids: ["doc-1:0", "doc-1:1"] });

  expect(getMock).toHaveBeenCalledWith({
    ids: ["doc-1:0", "doc-1:1"],
    include: expect.arrayContaining(["documents", "metadatas"]),
  });
  expect(hits[0]).toEqual({
    documentId: "doc-1",
    filename: "sample.txt",
    chunkIndex: 0,
    text: "hello",
  });
});

it("getByIds() returns empty array for empty ids input", async () => { /* no Chroma call */ });
it("getByIds() passes optional collection to getOrCreateCollection", async () => { /* lines 139-181 */ });
```

---

### `packages/core/src/registry/settings-store.ts` (extend)

**Analog:** Same file — extend seed + getter alongside `getChunkConfig`

**Schema load + seed pattern** (lines 9-27):
```typescript
function seedSettingsIfMissing(db: Database.Database, config: AppConfig): void {
  const existing = db
    .prepare("SELECT 1 AS found FROM settings WHERE id = 1")
    .get();

  if (!existing) {
    db.prepare(
      `INSERT INTO settings (
        id, chunk_size, chunk_overlap,
        read_around_window_default, read_around_window_max,
        read_around_max_chars, read_file_max_chunks, read_file_max_chars
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      config.CHUNK_SIZE,
      config.CHUNK_OVERLAP,
      config.READ_AROUND_WINDOW_DEFAULT,
      config.READ_AROUND_WINDOW_MAX,
      config.READ_AROUND_MAX_CHARS,
      config.READ_FILE_MAX_CHUNKS,
      config.READ_FILE_MAX_CHARS,
    );
  }
}
```

**Getter pattern** (lines 46-51):
```typescript
export interface SettingsStore {
  db: Database.Database;
  getChunkConfig(): ChunkConfig;
  getContextConfig(): ContextConfig; // new
  updateContextConfig(patch: Partial<ContextConfig>): ContextConfig; // for PATCH route
}

getContextConfig(): ContextConfig {
  return db.prepare(`
    SELECT
      read_around_window_default AS readAroundWindowDefault,
      read_around_window_max AS readAroundWindowMax,
      read_around_max_chars AS readAroundMaxChars,
      read_file_max_chunks AS readFileMaxChunks,
      read_file_max_chars AS readFileMaxChars
    FROM settings WHERE id = 1
  `).get() as ContextConfig;
}
```

**Singleton guard** (lines 63-69):
```typescript
export function getContextConfig(): ContextConfig {
  if (!activeStore) {
    throw new Error("Settings store not initialized. Call initSettingsStore() first.");
  }
  return activeStore.getContextConfig();
}
```

---

### `packages/core/src/registry/schema.sql` (extend)

**Analog:** Existing `settings` table (lines 1-5)

```sql
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  chunk_size INTEGER NOT NULL,
  chunk_overlap INTEGER NOT NULL,
  read_around_window_default INTEGER NOT NULL DEFAULT 1,
  read_around_window_max INTEGER NOT NULL DEFAULT 3,
  read_around_max_chars INTEGER NOT NULL DEFAULT 32000,
  read_file_max_chunks INTEGER NOT NULL DEFAULT 50,
  read_file_max_chars INTEGER NOT NULL DEFAULT 64000
);
```

**Note:** Existing DBs may need migration via `ALTER TABLE` in `ensureSchema` or a one-time migration block — follow same `db.exec(loadSchemaSql())` bootstrap (settings-store lines 14-16).

---

### `packages/core/src/registry/types.ts` — add `ContextConfig`

**Analog:** `ChunkConfig` (lines 1-4)

```typescript
export interface ContextConfig {
  readAroundWindowDefault: number;
  readAroundWindowMax: number;
  readAroundMaxChars: number;
  readFileMaxChunks: number;
  readFileMaxChars: number;
}
```

---

### `packages/config/src/env.ts` (context defaults)

**Analog:** `CHUNK_SIZE` / `CHUNK_OVERLAP` (lines 94-95)

```typescript
READ_AROUND_WINDOW_DEFAULT: z.coerce.number().default(1),
READ_AROUND_WINDOW_MAX: z.coerce.number().default(3),
READ_AROUND_MAX_CHARS: z.coerce.number().default(32000),
READ_FILE_MAX_CHUNKS: z.coerce.number().default(50),
READ_FILE_MAX_CHARS: z.coerce.number().default(64000),
```

---

### `packages/core/src/index.ts` (exports)

**Analog:** SearchService export block (lines 40-41)

```typescript
export { ContextService } from "./context/context-service.js";
export type {
  ReadAroundOptions,
  ReadAroundResult,
  ReadFileResult,
  ContextChunk,
} from "./context/types.js";
export type { ContextConfig } from "./registry/types.js";
export type { GetByIdsParams, ChunkHit } from "./vector-store/chroma-store.js";
// extend SettingsStore interface export if updateContextConfig added
```

---

### `apps/backend/src/routes/settings.ts` (route, CRUD)

**Analog:** `apps/backend/src/routes/search.ts` (Zod + routeOpts) + `documents.ts` GET handler shape

**Route registration + Zod** (search.ts lines 1-12, 31-58):
```typescript
import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod/v4";
import type { SettingsStore } from "@kb/core";
import { mapContextSettingsError } from "../lib/errors.js";
import type { ApiRouteOpts } from "../auth.js";

const ContextSettingsSchema = z.object({
  readAroundWindowDefault: z.number().int().min(1).max(10),
  readAroundWindowMax: z.number().int().min(1).max(10),
  readAroundMaxChars: z.number().int().min(1000),
  readFileMaxChunks: z.number().int().min(1),
  readFileMaxChars: z.number().int().min(1000),
}).refine(
  (data) => data.readAroundWindowMax >= data.readAroundWindowDefault,
  { message: "readAroundWindowMax must be >= readAroundWindowDefault" },
);

export async function registerSettingsRoutes(
  app: FastifyInstance,
  deps: { settingsStore: SettingsStore; routeOpts?: ApiRouteOpts },
): Promise<void> {
  const opts = deps.routeOpts ?? {};

  app.withTypeProvider<ZodTypeProvider>().get(
    "/api/v1/settings",
    opts,
    async () => ({
      chunk: deps.settingsStore.getChunkConfig(),
      context: deps.settingsStore.getContextConfig(),
    }),
  );

  app.withTypeProvider<ZodTypeProvider>().patch(
    "/api/v1/settings/context",
    {
      ...opts,
      schema: { body: ContextSettingsSchema },
    },
    async (request, reply) => {
      try {
        const updated = deps.settingsStore.updateContextConfig(request.body);
        return { context: updated };
      } catch (error) {
        const mapped = mapContextSettingsError(error);
        return (reply as FastifyReply).status(mapped.statusCode).send(mapped.body);
      }
    },
  );
}
```

**Auth passthrough** (search.ts lines 26-28, 38):
```typescript
export interface SettingsDeps {
  settingsStore: SettingsStore;
  routeOpts?: ApiRouteOpts;
}
// Spread ...(deps.routeOpts ?? {}) or pass opts to GET/PATCH
```

---

### `apps/backend/src/routes/settings.test.ts` (test)

**Analog:** `apps/backend/src/routes/search.test.ts`

**Fastify inject harness** (search.test lines 10-31, 33-61):
```typescript
async function buildApp() {
  const settingsStore = {
    getChunkConfig: vi.fn().mockReturnValue({ chunkSize: 1024, chunkOverlap: 154 }),
    getContextConfig: vi.fn().mockReturnValue({
      readAroundWindowDefault: 1,
      readAroundWindowMax: 3,
      readAroundMaxChars: 32000,
      readFileMaxChunks: 50,
      readFileMaxChars: 64000,
    }),
    updateContextConfig: vi.fn().mockImplementation((patch) => ({ ...patch })),
  };

  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  await registerSettingsRoutes(app, { settingsStore: settingsStore as never });
  return { app, settingsStore };
}
```

---

### `apps/backend/src/routes/search.ts` + `documents.ts` (reference only — no Phase 5 edits required)

**Use as route/error templates:**

**Search POST handler** (search.ts lines 46-57):
```typescript
async (request, reply) => {
  try {
    const results = await deps.searchService.search(request.body.query, {
      topK: request.body.topK,
      collection: request.body.collection,
    });
    return { results };
  } catch (error) {
    const mapped = mapSearchError(error);
    return (reply as FastifyReply).status(mapped.statusCode).send(mapped.body);
  }
},
```

**Documents 404** (documents.ts lines 110-117):
```typescript
const doc = deps.registry.getDocument(documentId);
if (!doc) {
  const mapped = notFound(documentId);
  return reply.code(mapped.statusCode).send(mapped.body);
}
```

---

### `apps/backend/src/lib/errors.ts` (extend)

**Analog:** `notFound` + `mapSearchError` (lines 51-80)

```typescript
export function mapContextError(error: unknown): {
  statusCode: number;
  body: ErrorBody;
} {
  if (error instanceof ContextError) {
    if (error.code === "document_not_found") {
      return { statusCode: 404, body: { error: "not_found", message: error.message } };
    }
    if (error.code === "chunk_index_out_of_range") {
      return { statusCode: 400, body: { error: "bad_request", message: error.message } };
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return { statusCode: 500, body: { error: "internal_error", message } };
}

export function mapContextSettingsError(error: unknown): {
  statusCode: number;
  body: ErrorBody;
} {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("must be >=")) {
    return { statusCode: 400, body: { error: "validation_error", message } };
  }
  return { statusCode: 500, body: { error: "internal_error", message } };
}
```

**ErrorBody shape** (lines 3-6):
```typescript
export interface ErrorBody {
  error: string;
  message: string;
}
```

---

### `apps/backend/src/services.ts` (wire ContextService + expose settingsStore)

**Analog:** Current wiring (lines 25-55)

```typescript
import {
  ChromaVectorStore,
  ContextService,
  EmbeddingClient,
  getDocumentRegistry,
  IngestionService,
  initSettingsStore,
  SearchService,
  type DocumentRegistry,
  type SettingsStore,
} from "@kb/core";

export interface AppServices {
  config: AppConfig;
  registry: DocumentRegistry;
  settingsStore: SettingsStore;
  vectorStore: ChromaVectorStore;
  embeddingClient: EmbeddingClient;
  ingestionService: IngestionService;
  searchService: SearchService;
  contextService: ContextService;
  uploadsDir: string;
}

export async function createAppServices(): Promise<AppServices> {
  const config = loadConfig();
  const settingsStore = initSettingsStore(config);
  const registry = getDocumentRegistry(settingsStore.db);
  const vectorStore = new ChromaVectorStore(config);
  const embeddingClient = new EmbeddingClient(config);

  const contextService = ContextService.create(config, {
    registry,
    vectorStore,
    settingsStore,
  });

  return {
    config,
    registry,
    settingsStore,
    vectorStore,
    embeddingClient,
    ingestionService,
    searchService,
    contextService,
    uploadsDir,
  };
}
```

---

### `apps/backend/src/index.ts` (register settings routes)

**Analog:** search route registration (lines 58-61)

```typescript
await registerSettingsRoutes(app, {
  settingsStore: services.settingsStore,
  routeOpts,
});
```

Keep registration after `registerBearerAuthIfEnabled` and pass same `routeOpts` as documents/search (lines 48-61).

---

### `apps/web/src/components/SettingsPanel.tsx` (component, request-response)

**Analog:** `SearchPanel.tsx` (form + mutation + 简体中文) + `UploadPanel.tsx` (success/error banners)

**State + mutation** (SearchPanel lines 1-28):
```typescript
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../types.js";
import { fetchSettings, updateContextSettings } from "../api/settings.js";

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: fetchSettings,
  });

  const mutation = useMutation({
    mutationFn: updateContextSettings,
    onSuccess: () => {
      setError(null);
      setSuccess("已保存上下文检索设置");
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => {
      setSuccess(null);
      setError(
        err instanceof ApiError
          ? `请求失败：${err.message}`
          : err instanceof Error
            ? err.message
            : "保存失败",
      );
    },
  });
```

**Grouped form layout** (SearchPanel lines 38-73 — field/label/btn classes):
```typescript
return (
  <div className="panel-stack">
    <section>
      <h2>分块</h2>
      <p className="muted">入库分块参数（只读展示或后续扩展编辑）</p>
      {/* chunk_size / chunk_overlap display from settingsQuery.data.chunk */}
    </section>
    <section>
      <h2>上下文检索</h2>
      <form className="search-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="ctx-window-default">默认窗口 (±N)</label>
          <input id="ctx-window-default" type="number" min={1} /* ... */ />
        </div>
        {/* readAroundWindowMax, readAroundMaxChars, readFileMaxChunks, readFileMaxChars */}
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "保存中…" : "保存设置"}
        </button>
      </form>
    </section>
    {error ? <div className="banner-error">{error}</div> : null}
    {success ? <div className="banner-success">{success}</div> : null}
  </div>
);
```

**Client-side validation** (UploadPanel error mapping lines 21-51 — validate max ≥ default before submit):
```typescript
if (form.readAroundWindowMax < form.readAroundWindowDefault) {
  setError("最大窗口必须大于或等于默认窗口");
  return;
}
```

---

### `apps/web/src/components/SearchPanel.tsx` + `UploadPanel.tsx` (reference — styling/layout)

**SearchPanel form shell** (lines 38-73): `panel-stack`, `search-form`, `field`, `btn btn-primary`, `banner-error`, `empty-state`.

**UploadPanel feedback** (lines 106-107):
```typescript
{error ? <div className="banner-error">{error}</div> : null}
{success ? <div className="banner-success">{success}</div> : null}
```

**Result card pattern** (SearchPanel lines 84-104) — reuse `result-meta` / `mono` if displaying read_around preview in future; Phase 5 settings panel only.

---

### `apps/web/src/api/settings.ts` (utility, CRUD)

**Analog:** `apps/web/src/api/search.ts`

```typescript
import { apiRequest } from "./client.js";

export interface ContextSettings {
  readAroundWindowDefault: number;
  readAroundWindowMax: number;
  readAroundMaxChars: number;
  readFileMaxChunks: number;
  readFileMaxChars: number;
}

export async function fetchSettings(): Promise<{
  chunk: { chunkSize: number; chunkOverlap: number };
  context: ContextSettings;
}> {
  return apiRequest("/api/v1/settings");
}

export async function updateContextSettings(
  patch: Partial<ContextSettings>,
): Promise<{ context: ContextSettings }> {
  return apiRequest("/api/v1/settings/context", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
```

**apiRequest auth + 401 retry** (client.ts lines 48-85) — no changes needed; settings routes use same Bearer gate.

---

### `apps/web/src/App.tsx` + `AppShell.tsx` (new settings tab)

**Analog:** Existing tab wiring (App.tsx lines 44-51; AppShell lines 1-13)

```typescript
// AppShell.tsx
export type AppTab = "documents" | "search" | "settings" | "help";

const TABS: { id: AppTab; label: string }[] = [
  { id: "documents", label: "文档" },
  { id: "search", label: "搜索" },
  { id: "settings", label: "设置" },
  { id: "help", label: "使用说明" },
];

// App.tsx
import { SettingsPanel } from "./components/SettingsPanel.js";
{activeTab === "settings" ? <SettingsPanel /> : null}
```

---

## Shared Patterns

### Authentication (Bearer gate)
**Source:** `apps/backend/src/auth.ts`
**Apply to:** `registerSettingsRoutes` — pass `routeOpts` from `apiRouteOpts(config, app)`

```typescript
export function apiRouteOpts(
  config: AppConfig,
  app: FastifyInstance,
): ApiRouteOpts {
  if (!config.AUTH_ENABLED) {
    return {};
  }
  return { preHandler: [verify] };
}
```

### Error Handling (backend JSON)
**Source:** `apps/backend/src/lib/errors.ts`
**Apply to:** settings PATCH + future context REST (Phase 6 MCP uses ContextError.code directly)

```typescript
export interface ErrorBody {
  error: string;
  message: string;
}
```

### Settings Bootstrap (SQLite single row)
**Source:** `packages/core/src/registry/settings-store.ts`
**Apply to:** schema.sql, env.ts, settings-store seed, ContextService live reads

```typescript
const existing = db.prepare("SELECT 1 AS found FROM settings WHERE id = 1").get();
if (!existing) {
  db.prepare("INSERT INTO settings (id, ...) VALUES (1, ?, ...)").run(/* env defaults */);
}
```

### Web API Client
**Source:** `apps/web/src/api/client.ts`
**Apply to:** `apps/web/src/api/settings.ts`

```typescript
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  // Bearer from sessionStorage; 401 → ApiKeyModal retry
}
```

### Chunk ID Convention
**Source:** `packages/core/src/vector-store/chroma-store.ts`
**Apply to:** ContextService window computation + getByIds batch fetch

```typescript
export function buildChunkId(documentId: string, chunkIndex: number): string {
  return `${documentId}:${chunkIndex}`;
}
```

### Service Factory + DI
**Source:** `apps/backend/src/services.ts` + `SearchService.create`
**Apply to:** ContextService wiring alongside SearchService; settingsStore shared with IngestionService

```typescript
const settingsStore = initSettingsStore(config);
const registry = getDocumentRegistry(settingsStore.db);
const contextService = ContextService.create(config, { registry, vectorStore, settingsStore });
```

### Vitest Mock Store
**Source:** `packages/core/src/registry/settings-store.test.ts`
**Apply to:** context settings seed/get tests

```typescript
function makeConfig(dbPath: string, overrides: Partial<AppConfig> = {}): AppConfig {
  return { /* full AppConfig */ ...overrides };
}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/core/src/context/context-service.ts` (`read_file` truncation) | service | transform | No prior bounded multi-chunk assembly in codebase — implement from CONTEXT D-04–D-08 semantics |
| SQLite migration for existing `settings` rows | migration | — | `CREATE TABLE IF NOT EXISTS` won't add columns; planner must add explicit ALTER/migration step |

---

## Metadata

**Analog search scope:** `packages/core/src/{search,vector-store,registry}/`, `apps/backend/src/{routes,lib,services.ts,index.ts}`, `apps/web/src/{components,api}/`, `packages/config/src/env.ts`
**Files scanned:** ~35
**Pattern extraction date:** 2026-07-05

## PATTERN MAPPING COMPLETE

**Phase:** 5 - Context Retrieval Core
**Files classified:** 18
**Analogs found:** 16 / 18

### Coverage
- Files with exact analog: 14
- Files with role-match analog: 2
- Files with no analog: 2

### Key Patterns Identified
- **ContextService** mirrors `SearchService.create` factory but orchestrates `DocumentRegistry.getChunkIds` → `ChromaVectorStore.getByIds` with live `SettingsStore.getContextConfig()` on every call
- **getByIds** mirrors `query()` metadata mapping but uses `collection.get({ ids, include })` instead of semantic query
- **Settings extension** follows single-row SQLite seed from env defaults (`chunk_size` pattern) with new grouped admin fields under 「上下文检索」
- **Backend settings routes** follow `search.ts` Zod + try/catch error mapping and `documents.ts` auth via `routeOpts`
- **SettingsPanel** combines `SearchPanel` form/mutation structure with `UploadPanel` success/error banners and 简体中文 copy

### File Created
`.planning/phases/05-context-retrieval-core/05-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
