# Phase 2: REST Backend & Search - Research

**Researched:** 2026-07-01
**Domain:** Fastify REST API, SearchService retrieval path, Chroma 3.4 query, multipart upload
**Confidence:** HIGH

## Summary

Phase 2 extends the thin `@kb/backend` Fastify shell with `/api/v1/` document CRUD and search routes, while introducing `SearchService` in `@kb/core` as the **single retrieval path** shared by REST (this phase) and MCP (Phase 3). Phase 1 already provides `IngestionService`, `DocumentRegistry`, `ChromaVectorStore` (upsert/delete), and `EmbeddingClient.embedQuery()` with the Qwen3 retrieval prefix — Phase 2 must **add query to the vector store** and **wire routes**, not duplicate embedding or Chroma logic.

The highest-risk integration points are: (1) **Chroma `collection.query()` with pre-computed embeddings** — use `queryEmbeddings`, never `queryTexts` (collection has `embeddingFunction: null`); (2) **cosine distance → similarity score** normalization for API/MCP parity; (3) **multipart upload → temp file → `IngestionService.ingest()`** respecting the existing CWD path guard; (4) **delete ordering** — Chroma vectors first, then registry row (CASCADE cleans `document_chunks`).

Backend currently ships only `fastify@^5.8.2` with health routes. Phase 2 adds `@fastify/multipart`, `fastify-type-provider-zod`, `@fastify/swagger`, `@fastify/swagger-ui`, and `zod@^4` (already in `@kb/config`). Verified npm versions (2026-07-01): `fastify@5.9.0`, `@fastify/multipart@10.0.0`, `@fastify/swagger@9.7.0`, `@fastify/swagger-ui@6.0.0`, `fastify-type-provider-zod@7.0.0`, `chromadb@3.5.0` (project pins `^3.4.3` — keep aligned with sidecar).

**Primary recommendation:** Implement `SearchService` + `ChromaVectorStore.query()` in `@kb/core` first (Plan 02-01), then Fastify bootstrap with Zod/Swagger/multipart (Plan 02-02), then REST routes (Plan 02-03). Use `collection.query({ queryEmbeddings, nResults, include: ["documents","metadatas","distances"] })` and `score = clamp(1 - distance, 0, 1)`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Document Upload (D-08 — research default)
- **D-08:** `POST /documents` accepts **multipart file upload** (`@fastify/multipart`); fields: single file + optional `collection` (defaults to `DEFAULT_COLLECTION`)
- **D-09:** Allowed MIME/extensions match Phase 1 parsers: `.txt`, `.md`, `.markdown`, `.pdf`
- **D-10:** Upload writes to a temp file under `DATA_DIR/uploads/` then calls existing `IngestionService.ingest()` — same pipeline as `pnpm ingest`

#### Ingest Response Semantics (D-11 — research default)
- **D-11:** **Synchronous ingest** — HTTP request blocks until ingest completes or fails; response `201` with `{ documentId, chunkCount, collection, status: "indexed" }`
- **D-12:** Failures return `4xx/5xx` with clear JSON `{ error, message }` (e.g. scanned PDF rejection propagates from parser)

#### Search API (D-13 — research default)
- **D-13:** `POST /search` with JSON body `{ query: string, topK?: number, collection?: string }`
- **D-14:** Default `topK = 5`, hard max `10` (aligns with MCP bounds in Phase 3)
- **D-15:** `SearchService.search()` uses `EmbeddingClient.embedQuery()` (Qwen3 retrieval prefix) → Chroma query → ranked results
- **D-16:** Each result includes: `score`, `text` (snippet, truncated ~500 chars), `documentId`, `filename`, `chunkIndex`

#### Document List & Delete (D-17 — research default)
- **D-17:** `GET /documents` returns **full list** (no pagination v1 — local KB scale); fields: `id`, `filename`, `status`, `chunkCount`, `collection`, `createdAt`, `updatedAt` (omit internal `sourcePath` from API response unless needed for debug)
- **D-18:** `DELETE /documents/:documentId` removes registry row + Chroma vectors via existing `ChromaVectorStore.deleteByDocumentId()`; `404` if unknown id
- **D-19:** No batch delete in v1

#### API Surface & Docs (D-20 — research default)
- **D-20:** Routes prefixed under `/api/v1/` (e.g. `/api/v1/documents`, `/api/v1/search`); health routes stay at `/health*` (Phase 1 compatibility)
- **D-21:** OpenAPI via `@fastify/swagger` + `@fastify/swagger-ui` at `/docs` (dev discoverability)
- **D-22:** Request/response validation via `fastify-type-provider-zod` + Zod schemas in route modules

### Claude's Discretion (user selected option 7 — "you decide")
- Exact snippet truncation length and score normalization (distance → similarity)
- Temp upload cleanup policy (delete after successful ingest vs retain for debug)
- Whether `GET /documents/:id` detail endpoint is needed for v1 (add if trivial via registry)
- Chroma query API details (`collection.query` vs get+filter) — follow chromadb 3.4 patterns from Phase 1
- Error mapping from core exceptions to HTTP status codes

### Deferred Ideas (OUT OF SCOPE)
- Async ingest with job status polling (202 Accepted) — defer to v1.x if sync ingest too slow
- Pagination / filtering on document list — defer until corpus size warrants
- Batch delete — Phase 4 admin convenience
- API key auth (`@fastify/bearer-auth`) — Phase 4 CONF-03
- `GET /` root route or landing page — not required; `/docs` for API discovery
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | Operator can upload documents via REST API for ingestion | `@fastify/multipart` + temp file under `DATA_DIR/uploads/` + `IngestionService.ingest()`; sync `201` response per D-11 |
| API-02 | Operator can list indexed documents via REST API | `DocumentRegistry.listDocuments()` mapped to public DTO (omit `sourcePath`); optional `GET /documents/:id` via `getDocument()` |
| API-03 | Operator can delete a document and its vectors via REST API | Ordered delete: `deleteByDocumentId()` then `registry.deleteDocument()`; `404` when missing; SQLite CASCADE on `document_chunks` |
| API-04 | Operator can run test semantic search via REST API (same query path as MCP) | `SearchService.search()` in `@kb/core` — sole path for REST and future MCP; Chroma `queryEmbeddings` + score normalization |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Document upload & ingest | API / Backend | Core (`IngestionService`) | HTTP multipart parsing, temp file I/O, status codes belong in Fastify; parse/chunk/embed/upsert stays in core |
| Document list/delete metadata | API / Backend | Core (`DocumentRegistry`) | Routes shape JSON responses; registry owns SQLite CRUD |
| Vector delete on document removal | Core (`ChromaVectorStore`) | API / Backend | Chroma adapter already owns `deleteByDocumentId`; route orchestrates call order |
| Query embedding | Core (`EmbeddingClient`) | — | Same client for ingest and search; never duplicate in routes |
| Semantic search & result formatting | Core (`SearchService`) | Core (`ChromaVectorStore.query`) | Single retrieval path for REST + MCP; routes are thin delegates |
| Request validation & OpenAPI | API / Backend | — | Zod schemas + `fastify-type-provider-zod` at route layer |
| Health checks | API / Backend | Core adapters | Already implemented Phase 1; unchanged at `/health*` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `fastify` | `5.9.0` | REST server | Phase 1 backend already uses Fastify 5; native schema, Pino logging [VERIFIED: npm registry] |
| `@fastify/multipart` | `10.0.0` | File upload | Official Fastify multipart plugin; stream-to-disk via `pipeline` [CITED: github.com/fastify/fastify-multipart] |
| `fastify-type-provider-zod` | `7.0.0` | Route validation + types | Pairs with Zod 4 + Fastify 5; `jsonSchemaTransform` for Swagger [CITED: github.com/turkerdev/fastify-type-provider-zod] |
| `zod` | `4.4.3` | Schemas | Already in `@kb/config`; v4 required by fastify-type-provider-zod ≥5.x [VERIFIED: npm registry] |
| `@fastify/swagger` | `9.7.0` | OpenAPI generation | Auto-docs from route schemas [VERIFIED: npm registry] |
| `@fastify/swagger-ui` | `6.0.0` | Interactive docs at `/docs` | Dev discoverability per D-21 [VERIFIED: npm registry] |
| `chromadb` | `3.4.3` (project pin) | Vector query client | Phase 1 upsert/delete already uses 3.4 API; match sidecar version [VERIFIED: packages/core/package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs/promises` + `node:stream/promises` | Node 24 | Temp upload I/O | Write multipart stream to `DATA_DIR/uploads/` |
| `node:crypto` `randomUUID()` | Node 24 | Unique upload filenames | Avoid collisions on same original filename |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `req.parts()` loop | `attachFieldsToBody: true` + Zod | attachFieldsToBody enables Zod body validation but complicates multipart+Swagger; manual parsing is simpler for v1 single-file upload [CITED: fastify-multipart README] |
| `collection.query()` | `get()` + client-side filter | query is the correct ANN path; get+filter does not rank by similarity |
| Add `GET /documents/:id` | List-only | Trivial via `registry.getDocument()` — **recommend adding** for debug/admin parity |

**Installation:**

```bash
pnpm add --filter @kb/backend @fastify/multipart @fastify/swagger @fastify/swagger-ui fastify-type-provider-zod zod
pnpm add --filter @kb/backend -D @types/node  # if not already present
```

**Version verification:** npm view on 2026-07-01 — fastify 5.9.0, @fastify/multipart 10.0.0, @fastify/swagger 9.7.0, @fastify/swagger-ui 6.0.0, fastify-type-provider-zod 7.0.0, chromadb 3.5.0 (latest; project uses ^3.4.3).

## Architecture Patterns

### System Architecture Diagram

```
Operator / Web (Phase 4)
        │
        ▼ HTTP multipart / JSON
┌───────────────────────────────────────┐
│  apps/backend (Fastify)               │
│  /api/v1/documents  POST/GET/DELETE   │
│  /api/v1/search     POST              │
│  /health*           GET (unchanged)   │
│  /docs              Swagger UI        │
└───────────────┬───────────────────────┘
                │ delegates
                ▼
┌───────────────────────────────────────┐
│  packages/core                        │
│  IngestionService ──► embed + upsert  │
│  SearchService    ──► embedQuery +   │
│                       vectorStore.query│
│  DocumentRegistry ──► SQLite metadata │
│  ChromaVectorStore ─► HTTP Chroma     │
└───────────────┬───────────────────────┘
                │
                ▼
        Chroma sidecar (cosine, explicit embeddings)
        CherryIn API (qwen3-embedding-8b)
        SQLite registry.db
```

### Recommended Project Structure

```
packages/core/src/
├── search/
│   ├── search-service.ts      # SearchService + SearchResult types
│   └── search-service.test.ts
├── vector-store/
│   └── chroma-store.ts        # ADD query() method
apps/backend/src/
├── index.ts                   # bootstrap: zod provider, swagger, multipart, services
├── services.ts                # wire registry, ingestion, search (optional)
├── schemas/
│   ├── documents.ts           # Zod request/response schemas
│   └── search.ts
└── routes/
    ├── health.ts              # existing
    ├── documents.ts           # API-01, API-02, API-03
    └── search.ts              # API-04
```

### Pattern 1: SearchService as Single Retrieval Path

**What:** Core service encapsulates embed-query → Chroma ANN → normalize scores → format snippets.

**When to use:** Every retrieval surface (REST test search, MCP Phase 3) calls this class only.

**Example:**

```typescript
// packages/core/src/search/search-service.ts
// Source: ARCHITECTURE.md + chromadb.d.ts query signature [VERIFIED: codebase + node_modules/chromadb]

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

export class SearchService {
  constructor(
    private readonly embeddingClient: EmbeddingClient,
    private readonly vectorStore: ChromaVectorStore,
    private readonly defaultCollection: string,
    private readonly defaultTopK = 5,
    private readonly maxTopK = 10,
    private readonly snippetMaxLen = 500,
  ) {}

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const topK = Math.min(options?.topK ?? this.defaultTopK, this.maxTopK);
    const collection = options?.collection ?? this.defaultCollection;

    const embedding = await this.embeddingClient.embedQuery(query);
    const rows = await this.vectorStore.query({
      embedding,
      topK,
      collection,
    });

    return rows.map((row) => ({
      score: normalizeCosineScore(row.distance),
      text: truncateSnippet(row.document ?? "", this.snippetMaxLen),
      documentId: String(row.metadata?.document_id ?? ""),
      filename: String(row.metadata?.filename ?? ""),
      chunkIndex: Number(row.metadata?.chunk_index ?? 0),
    }));
  }
}

function normalizeCosineScore(distance: number | null | undefined): number {
  if (distance == null) return 0;
  // Chroma cosine: d = 1 - cos_sim; higher score = better match
  // [CITED: docs.trychroma.com/docs/collections/configure]
  const score = 1 - distance;
  return Math.max(0, Math.min(1, score));
}

function truncateSnippet(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}
```

### Pattern 2: ChromaVectorStore.query via collection.query

**What:** Add `query()` to existing store; use pre-computed embeddings only.

**When to use:** All semantic search — never `queryTexts` (embedding function is null).

**Example:**

```typescript
// packages/core/src/vector-store/chroma-store.ts (ADD)
// Source: node_modules/chromadb/dist/chromadb.d.ts Collection.query [VERIFIED]

async query(params: {
  embedding: number[];
  topK: number;
  collection?: string;
}): Promise<Array<{
  id: string;
  document: string | null;
  distance: number | null;
  metadata: Record<string, unknown> | null;
}>> {
  const col = await this.getOrCreateCollection(params.collection);
  const result = await col.query({
    queryEmbeddings: [params.embedding],
    nResults: params.topK,
    include: ["documents", "metadatas", "distances"],
  });

  const rows = result.rows()[0] ?? [];
  return rows.map((row) => ({
    id: row.id,
    document: row.document ?? null,
    distance: row.distance ?? null,
    metadata: (row.metadata as Record<string, unknown>) ?? null,
  }));
}
```

**Why `collection.query` not `get+filter`:** `query` performs HNSW approximate nearest-neighbor search ranked by distance. `get({ where })` returns matching records without similarity ranking — wrong semantics for semantic search [CITED: cookbook.chromadb.dev/core/collections].

### Pattern 3: Fastify Bootstrap with Zod + Swagger

**What:** Register validator/serializer compilers, swagger with `jsonSchemaTransform`, then routes with `ZodTypeProvider`.

**Example:**

```typescript
// apps/backend/src/index.ts
// Source: github.com/turkerdev/fastify-type-provider-zod [CITED]

import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifySwagger, {
  openapi: {
    info: { title: "kb-mcp-server API", version: "1.0.0" },
  },
  transform: jsonSchemaTransform,
});

await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

await app.register(fastifyMultipart, {
  limits: { files: 1, fileSize: 50 * 1024 * 1024 }, // match PDF parser max
});
```

**Note:** Register routes **after** swagger using `app.withTypeProvider<ZodTypeProvider>()` per route module, or use `app.after()` hook pattern from official examples.

### Pattern 4: Multipart Upload → Ingest

**What:** Parse multipart with `req.parts()`, save file to disk, call `IngestionService.ingest()`, cleanup temp file.

**Example:**

```typescript
// apps/backend/src/routes/documents.ts (POST handler sketch)
// Source: github.com/fastify/fastify-multipart README [CITED]

import { mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
]);

app.post("/api/v1/documents", async (req, reply) => {
  let collection: string | undefined;
  let tempPath: string | undefined;

  const parts = req.parts();
  for await (const part of parts) {
    if (part.type === "field" && part.fieldname === "collection") {
      collection = String(part.value);
    } else if (part.type === "file") {
      if (!ALLOWED_MIME.has(part.mimetype)) {
        return reply.code(415).send({ error: "unsupported_media_type", message: `Unsupported: ${part.mimetype}` });
      }
      await mkdir(uploadDir, { recursive: true });
      tempPath = join(uploadDir, `${randomUUID()}-${part.filename}`);
      await pipeline(part.file, createWriteStream(tempPath));
    }
  }

  if (!tempPath) {
    return reply.code(400).send({ error: "bad_request", message: "Missing file field" });
  }

  try {
    const result = await ingestionService.ingest(tempPath, { collection });
    await unlink(tempPath).catch(() => {}); // cleanup on success
    return reply.code(201).send({ ...result, status: "indexed" });
  } catch (error) {
    // retain tempPath on failure for operator debug [research default]
    throw mapIngestError(error);
  }
});
```

**CWD guard:** `IngestionService.resolveIngestPath()` requires path under `process.cwd()`. Ensure `DATA_DIR` resolves under repo root (default `./data`) and backend starts from project root (`pnpm dev` already does) [VERIFIED: packages/core/src/ingestion/ingestion-service.ts].

### Pattern 5: Delete Flow (Registry + Vectors)

**What:** Lookup document → delete Chroma vectors → delete registry row.

**Order rationale:** If Chroma delete fails, registry remains intact (document still listed, retry possible). SQLite `document_chunks` CASCADE deletes when parent document row is removed [VERIFIED: packages/core/src/registry/schema.sql].

```typescript
async deleteDocument(documentId: string): Promise<void> {
  const doc = registry.getDocument(documentId);
  if (!doc) throw new NotFoundError(documentId);

  await vectorStore.deleteByDocumentId(documentId, doc.collection);
  registry.deleteDocument(documentId);
}
```

### Anti-Patterns to Avoid

- **Duplicating Chroma query in route handlers:** Violates Phase 2 success criterion #4 and Phase 3 MCP parity.
- **Using `queryTexts` on null embedding function collection:** Will fail or invoke wrong code path; always pass `queryEmbeddings`.
- **Deleting registry before Chroma:** Orphan vectors with no metadata to find them via list API.
- **Returning raw Chroma distances as `score`:** Lower distance = better match; API contract expects higher = better (similarity).
- **attachFieldsToBody without consuming all file streams:** Multipart promises hang if streams not consumed [CITED: fastify-multipart README].

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multipart parsing | Custom busboy wrapper | `@fastify/multipart` | Stream backpressure, limits, error types |
| JSON Schema from Zod | Manual OpenAPI YAML | `fastify-type-provider-zod` + `jsonSchemaTransform` | Stays in sync with route validation |
| ANN vector search | SQLite scan or manual cosine loop | `ChromaVectorStore.query` → `collection.query` | HNSW index, metadata filters, scale |
| Query embedding | Separate embed logic in routes | `EmbeddingClient.embedQuery()` | Qwen3 instruct prefix parity with ingest |
| Document ID from upload | Custom ID scheme | Existing `deriveDocumentId(absolutePath)` | Re-upload same filename = new temp path = new id (documented Phase 1 behavior) |
| HTTP error shapes | Ad-hoc strings | Consistent `{ error, message }` per D-12 | Web admin Phase 4 consumes same shape |

**Key insight:** Phase 2 is a **wiring phase** — the heavy lifting exists in Phase 1. Custom retrieval or upload plumbing would fork the MCP/REST parity guarantee.

## Common Pitfalls

### Pitfall 1: Query vs Index Embedding Mismatch

**What goes wrong:** Search returns irrelevant results after config change, or dimension errors at query time.

**Why it happens:** Different embed paths or models between ingest and query.

**How to avoid:** `SearchService` calls `embedQuery()` only; same `EmbeddingClient` instance wired in backend bootstrap as ingest CLI.

**Warning signs:** Results exist but are nonsense; works in CLI ingest but not REST search.

### Pitfall 2: Score Semantics Inverted

**What goes wrong:** Clients sort ascending by `score` and show worst matches first.

**Why it happens:** Chroma returns **distance** (lower = better); API exposes **score** (higher = better).

**How to avoid:** `score = clamp(1 - distance, 0, 1)` for cosine space configured in Phase 1 (`hnsw:space: cosine`) [CITED: docs.trychroma.com/docs/collections/configure].

**Warning signs:** Best match has lowest numeric score in raw Chroma output.

### Pitfall 3: Multipart Field Ordering

**What goes wrong:** `collection` field is undefined when read before file stream consumed.

**Why it happens:** Busboy parses serially; `data.fields` only contains fields parsed so far [CITED: fastify-multipart README].

**How to avoid:** Use `req.parts()` iterator; read field parts when `part.type === 'field'`.

### Pitfall 4: Ingest Path Outside CWD

**What goes wrong:** `Path must be under current working directory` on upload.

**Why it happens:** `resolveIngestPath()` guard in `IngestionService` [VERIFIED: ingestion-service.ts].

**How to avoid:** Save uploads to `join(resolve(config.DATA_DIR), 'uploads', ...)` with `DATA_DIR` relative to repo root; run backend from repo root.

### Pitfall 5: Sync Ingest Timeout on Large PDFs

**What goes wrong:** HTTP client timeout during embed+upsert.

**Why it happens:** D-11 synchronous ingest; large PDFs = many chunks + CherryIn latency.

**How to avoid:** Document expected latency; consider increasing Fastify `connectionTimeout` only if needed. Deferred async ingest is out of scope.

**Warning signs:** Upload succeeds in CLI but HTTP times out at ~30s.

### Pitfall 6: Chroma Client/Server Version Skew

**What goes wrong:** Query API errors or schema mismatch.

**Why it happens:** npm `chromadb@3.4.x` vs sidecar from different version (env shows `chroma 1.4.4` CLI — verify sidecar matches JS client 3.x).

**How to avoid:** Use `scripts/start-chroma.ts` / `npx chroma run` from project's `chromadb` package version [VERIFIED: STACK.md compatibility table].

## Code Examples

### Chroma collection.query (TypeScript, pre-computed embeddings)

```typescript
// Source: node_modules/chromadb/dist/chromadb.d.ts + cookbook.chromadb.dev [VERIFIED]
const result = await collection.query({
  queryEmbeddings: [queryVector],
  nResults: 5,
  include: ["documents", "metadatas", "distances"],
});

for (const row of result.rows()[0] ?? []) {
  console.log(row.id, row.distance, row.document, row.metadata);
}
```

### Zod-validated search route

```typescript
// Source: fastify-type-provider-zod [CITED]
import { z } from "zod/v4";

const SearchBodySchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(10).optional(),
  collection: z.string().optional(),
});

const SearchResponseSchema = z.object({
  results: z.array(
    z.object({
      score: z.number(),
      text: z.string(),
      documentId: z.string(),
      filename: z.string(),
      chunkIndex: z.number(),
    }),
  ),
});

app.withTypeProvider<ZodTypeProvider>().post(
  "/api/v1/search",
  {
    schema: {
      body: SearchBodySchema,
      response: { 200: SearchResponseSchema },
    },
  },
  async (req) => {
    const results = await searchService.search(req.body.query, {
      topK: req.body.topK,
      collection: req.body.collection,
    });
    return { results };
  },
);
```

### Error mapping (recommended defaults)

```typescript
// Source: Phase 2 discretion — map core errors to HTTP [ASSUMED defaults for planner]

function mapIngestError(error: unknown): { statusCode: number; body: { error: string; message: string } } {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Unsupported file extension")) {
    return { statusCode: 415, body: { error: "unsupported_media_type", message } };
  }
  if (message === INSUFFICIENT_TEXT_ERROR) {
    return { statusCode: 422, body: { error: "unprocessable_entity", message } };
  }
  if (message.includes("exceeds maximum size")) {
    return { statusCode: 413, body: { error: "payload_too_large", message } };
  }
  if (message.includes("Path must be under")) {
    return { statusCode: 400, body: { error: "bad_request", message } };
  }
  // CherryIn / Chroma connectivity
  if (message.includes("Embedding API") || message.includes("ECONNREFUSED")) {
    return { statusCode: 503, body: { error: "service_unavailable", message } };
  }
  return { statusCode: 500, body: { error: "internal_error", message } };
}
```

## Claude's Discretion — Research Recommendations

| Topic | Recommendation | Rationale |
|-------|----------------|-----------|
| Snippet length | **500 chars**, append `…` if truncated | Matches D-16 "truncated ~500 chars"; aligns with MCP-06 bounds |
| Score normalization | **`score = max(0, min(1, 1 - distance))`** rounded to 4 decimals | Cosine distance semantics per Chroma docs; higher = better for API consumers |
| Temp upload cleanup | **Delete on success; retain on failure** | Keeps disk clean; failed uploads debuggable under `DATA_DIR/uploads/` |
| `GET /documents/:id` | **Add** — one handler, `registry.getDocument()`, 404 if missing | Trivial; helps web admin Phase 4; omit `sourcePath` in response |
| Chroma query API | **`collection.query({ queryEmbeddings })`** | Correct ANN path; consistent with Phase 1 `embeddingFunction: null` |
| Error mapping | Table above | Propagates Phase 1 parser errors with correct HTTP semantics |

## Wave / Plan Split Recommendation

Phase 1 used **3 plans / 3 waves** (foundation → adapters → ingestion+backend). Phase 2 should mirror that dependency order: **core retrieval before HTTP routes**.

| Plan | Wave | Scope | Requirements | Depends on |
|------|------|-------|--------------|------------|
| **02-01** | 1 | `ChromaVectorStore.query()`, `SearchService`, types, unit tests | API-04 (core path) | Phase 1 complete |
| **02-02** | 2 | Backend deps, Zod type provider, Swagger `/docs`, multipart plugin, service wiring (`IngestionService`, `SearchService`, registry) | (infrastructure) | 02-01 |
| **02-03** | 3 | Routes: `POST/GET/DELETE /api/v1/documents`, `POST /api/v1/search`, error mapper, manual E2E checkpoint | API-01, API-02, API-03, API-04 | 02-02 |

**Parallelization:** 02-01 can start immediately after Phase 1. No parallel plans within Phase 2 — each wave depends on prior.

**Checkpoint:** Plan 02-03 Task 4 should mirror Phase 1 human verification: upload sample fixtures → list → search → delete → confirm vectors gone (curl or REST client).

**Alternative (2-plan):** Merge 02-02+02-03 if team prefers fewer checkpoints — acceptable but increases review surface; **recommend 3-plan split** for clearer core/API boundary testing.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@fastify/multipart` 9.x | 10.0.0 | 2025–2026 | Fastify 5 compatible; verify `limits` defaults |
| Chroma JS v2 client | chromadb 3.4+ rewritten client | 2025 | Use `queryEmbeddings`, `result.rows()` API |
| Zod 3 + fastify-type-provider-zod 4.x | Zod 4 + provider 7.x | 2025–2026 | Import from `zod/v4` in backend schemas |
| Swagger UI at `/documentation` | D-21 specifies `/docs` | Project decision | Use `routePrefix: '/docs'` |

**Deprecated/outdated:**
- Legacy SSE-only MCP transport — Phase 3 concern, not Phase 2
- `queryTexts` on BYO-embedding collections — wrong for this project

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Qwen3 embeddings from CherryIn are sufficiently normalized for `1 - distance` scoring | Score normalization | Scores may exceed [0,1] — clamp handles this |
| A2 | Backend `process.cwd()` is repo root during `pnpm dev` | Upload path guard | Ingest throws path error — fix DATA_DIR or cwd |
| A3 | Chroma sidecar matches JS client 3.4.x API | query() | Runtime errors on query — align versions in start script |
| A4 | `document_id` metadata filter delete remains valid for query results | Delete flow | Already verified in Phase 1 tests |

## Open Questions

1. **Chroma sidecar version vs npm client**
   - What we know: Project pins `chromadb@^3.4.3`; system `chroma` CLI reports `1.4.4` [VERIFIED: shell probe]
   - What's unclear: Whether `scripts/start-chroma.ts` uses npm chromadb CLI or Python package
   - Recommendation: Planner should verify `pnpm dev` starts sidecar compatible with 3.4 client before 02-01 integration tests

2. **Fastify global error handler vs per-route try/catch**
   - What we know: D-12 requires `{ error, message }` JSON shape
   - What's unclear: Whether to use `setErrorHandler` or route wrappers
   - Recommendation: Central `setErrorHandler` mapping `AppError` subclasses — less duplication

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | ✓ | v24.13.0 | — |
| pnpm | Monorepo | ✓ | 11.9.0 | — |
| Chroma sidecar | Search + ingest | ✓ (via `pnpm dev`) | JS client 3.4.3 | Start with `scripts/start-chroma.ts` |
| CherryIn API | Embed query + ingest | ✓ (env) | qwen3-embedding-8b | 503 on `/health/embeddings` |
| SQLite registry | List/delete | ✓ | better-sqlite3 12.11.1 | Created at `SQLITE_PATH` |
| `@fastify/multipart` | API-01 upload | ✗ (not installed) | — | **Install in 02-02** |

**Missing dependencies with no fallback:**
- `@fastify/multipart`, `@fastify/swagger`, `@fastify/swagger-ui`, `fastify-type-provider-zod` in `@kb/backend` — must add before route work

**Missing dependencies with fallback:**
- None for Phase 2 scope

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 4 CONF-03 |
| V3 Session Management | no | Stateless REST v1 |
| V4 Access Control | partial | Localhost bind (CONF-04); no auth Phase 2 |
| V5 Input Validation | yes | Zod schemas on JSON routes; MIME/extension checks on upload |
| V6 Cryptography | no | TLS out of scope for local dev |

### Known Threat Patterns for Fastify + multipart

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unrestricted file upload | Tampering / DoS | MIME allowlist, `fileSize: 50MB`, single file limit |
| Path traversal in filename | Tampering | Sanitize filename; write to UUID-prefixed path under `DATA_DIR/uploads/` |
| Oversized JSON search query | DoS | Zod `query.max(2000)` |
| Error message leakage | Information disclosure | Return safe `message`; log full stack server-side only |

## Sources

### Primary (HIGH confidence)
- `node_modules/chromadb/dist/chromadb.d.ts` — `Collection.query`, `QueryResult.rows()` [VERIFIED]
- `packages/core/src/vector-store/chroma-store.ts` — upsert/delete, `embeddingFunction: null`, cosine metadata [VERIFIED]
- `packages/core/src/ingestion/ingestion-service.ts` — ingest orchestration, path guard [VERIFIED]
- `packages/core/src/embeddings/embedding-client.ts` — `embedQuery()` with Qwen3 prefix [VERIFIED]
- [Chroma Configure Collections](https://docs.trychroma.com/docs/collections/configure) — cosine distance formula [CITED]
- [fastify-multipart README](https://github.com/fastify/fastify-multipart/blob/main/README.md) — upload patterns, limits [CITED]
- [fastify-type-provider-zod](https://github.com/turkerdev/fastify-type-provider-zod) — Zod 4 + Swagger transform [CITED]
- npm registry `npm view` — package versions 2026-07-01 [VERIFIED]

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — SearchService dual-pipeline design
- `.planning/research/STACK.md` — Fastify stack pins
- `.planning/research/PITFALLS.md` — embedding mismatch, bounded top_k
- [Chroma Cookbook FAQ](https://cookbook.chromadb.dev/faq/) — distance vs similarity [CITED]

### Tertiary (LOW confidence)
- CherryIn rate limits during concurrent upload+search — not re-verified this session; defer to Phase 1 flag

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm versions verified; patterns match Phase 1 codebase
- Architecture: HIGH — SearchService shape pre-documented in ARCHITECTURE.md; Phase 1 adapters confirmed
- Pitfalls: HIGH — path guard and cosine scoring verified against official Chroma docs

**Research date:** 2026-07-01
**Valid until:** 2026-07-31 (stable Fastify/Chroma APIs)

## RESEARCH COMPLETE

**Phase:** 2 - REST Backend & Search
**Confidence:** HIGH

### Key Findings
- Phase 2 is primarily **wiring**: add `ChromaVectorStore.query()` + `SearchService`, then thin Fastify routes — no duplicate embed/Chroma logic
- Use **`collection.query({ queryEmbeddings, nResults, include: ["documents","metadatas","distances"] })`** — never `queryTexts` on null embedding function collections
- **Score normalization:** `score = clamp(1 - distance, 0, 1)` for cosine space; snippet truncate at **500 chars**
- **Delete order:** Chroma `deleteByDocumentId` first, then `registry.deleteDocument()` (SQLite CASCADE cleans chunk rows)
- **Recommended 3-plan split:** 02-01 core search → 02-02 backend bootstrap → 02-03 REST routes + E2E checkpoint

### File Created
`.planning/phases/02-rest-backend-search/02-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | npm versions verified; aligns with STACK.md and existing deps |
| Architecture | HIGH | Phase 1 code inspected; SearchService pattern pre-validated in ARCHITECTURE.md |
| Pitfalls | HIGH | Chroma cosine semantics from official docs; path guard verified in source |

### Open Questions
- Confirm Chroma sidecar startup script matches `chromadb@3.4.x` client API during 02-01 integration testing

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
