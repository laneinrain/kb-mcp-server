# Architecture Research

**Domain:** Knowledge-base MCP server (TypeScript monorepo, local-first RAG scaffold)
**Researched:** 2026-06-29
**Confidence:** HIGH (MCP spec + SDK patterns, RAG pipeline separation); MEDIUM (monorepo layout — strong community precedent, not a single canonical standard)

## Standard Architecture

### System Overview

Knowledge-base MCP systems converge on a **dual-pipeline RAG layout**: an offline **indexing pipeline** (ingest → parse → chunk → embed → store) and an online **retrieval pipeline** (query → embed → search → format results). The **vector store is the contract boundary** between them — both pipelines share the same embedding model, collection schema, and chunk ID conventions, but run in different processes or entrypoints.

MCP adds a third axis: **transport vs protocol vs domain logic**. The MCP data layer (tools, JSON-RPC) must stay transport-agnostic; stdio and HTTP/SSE (or Streamable HTTP) are thin adapters over the same search service.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Admin / Ingestion Surfaces                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                               │
│  │ Web UI   │    │ REST API │    │   CLI    │                               │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘                               │
│       │               │               │                                      │
│       └───────────────┴───────────────┘                                      │
│                       │ HTTP (optional API key)                              │
├───────────────────────┴─────────────────────────────────────────────────────┤
│                    Indexing Pipeline (packages/ingestion)                    │
│  Upload → Parse → Chunk → Embed (CherryIn) → Upsert                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                    Shared Domain Layer (packages/core)                     │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────────┐    │
│  │ DocumentRegistry│  │ IngestionService │  │ SearchService           │    │
│  │ (metadata/CRUD) │  │ (orchestration)  │  │ (query embed + retrieve)│    │
│  └────────┬────────┘  └────────┬─────────┘  └───────────┬─────────────┘    │
│           │                    │                          │                   │
├───────────┴────────────────────┴──────────────────────────┴───────────────────┤
│                    Infrastructure Adapters (packages/*)                      │
│  ┌──────────────────┐  ┌────────────────────┐  ┌─────────────────────────┐  │
│  │ parsers (txt/md/ │  │ embeddings         │  │ vector-store (Chroma    │  │
│  │ pdf)             │  │ (OpenAI-compatible)│  │ HTTP client)            │  │
│  └──────────────────┘  └────────────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────── Chroma Server (sidecar process) ──────────────┐  │
│  │  Persistent volume · single default collection (v1)                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────── Document metadata store ──────────────────────┐  │
│  │  SQLite or JSON file — doc list, source paths, ingest status          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         MCP Retrieval Surface                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────── apps/mcp-server ──────────────────────────────────┐  │
│  │  buildServer() → register search_knowledge tool                       │  │
│  │       │                                                               │  │
│  │       ├── StdioServerTransport  (Cursor local, 1 client)            │  │
│  │       └── HTTP / Streamable HTTP (remote, N clients)                  │  │
│  └───────────────────────────────┬─────────────────────────────────────┘  │
│                                  │ calls SearchService only               │
└──────────────────────────────────┴──────────────────────────────────────────┘
         ▲                                    ▲
         │ stdio subprocess                   │ HTTP
    ┌────┴────┐                          ┌────┴────┐
    │ Cursor  │                          │ Remote  │
    │ Claude  │                          │ clients │
    └─────────┘                          └─────────┘
```

**Reference implementations that validate this shape:**

| Project | Pattern | Relevance |
|---------|---------|-----------|
| [Knowledge Plane](https://github.com/camplight/knowledgeplane) | `apps/mcp-server` + `rest-api` + `webapp` + `packages/db` + `file-processor` | Closest full-stack precedent; MCP + REST + web + shared packages |
| [mcp-rag-server](https://github.com/0xrdan/mcp-rag-server) | MCP tools over Chroma; optional indexing tools | Validates Chroma + MCP bridge; this project intentionally omits ingest tools from MCP |
| [knowledge-mcp-server](https://github.com/shoyu-ramen/knowledge-mcp-server) | `KnowledgeEngine` library + MCP wrapper | Shows core engine extracted from transport — good package boundary |
| [mewisme/mcp](https://github.com/mewisme/mcp) | pnpm + Turborepo; `apps/server` + `apps/web` + `packages/shared` | Monorepo tooling pattern for MCP + admin UI |

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **MCP Server** (`apps/mcp-server`) | Expose retrieval tools only; no upload/CRUD | `@modelcontextprotocol/sdk` `McpServer` + `registerTool`; stdio + HTTP entrypoints sharing `buildServer()` |
| **REST API** (`apps/api`) | Ingestion, document CRUD, test search, health | Fastify or Express; calls `IngestionService` + `SearchService` |
| **Web Admin** (`apps/web`) | Upload, list docs, test search UI | Vite/React or Next.js; talks to REST API only |
| **CLI** (`apps/cli` or `packages/cli`) | Batch ingest, reindex, status | Commander/oclif; calls REST or imports `IngestionService` directly |
| **SearchService** (`packages/core`) | Query embedding + vector query + result formatting | Single entry used by MCP and API test-search |
| **IngestionService** (`packages/core`) | Orchestrate parse → chunk → embed → upsert | Async job per document; idempotent chunk IDs |
| **DocumentRegistry** (`packages/core`) | Track source files, ingest status, metadata | SQLite (recommended) or JSON; not stored in Chroma alone |
| **Parsers** (`packages/parsers`) | txt, markdown, text-layer PDF → normalized text | `pdf-parse` or similar; no OCR in v1 |
| **Chunker** (`packages/ingestion`) | Split text into retrieval units with overlap | Fixed-size or heading-aware; 200–500 token targets |
| **Embeddings client** (`packages/embeddings`) | Call CherryIn OpenAI-compatible API | `openai` SDK pointed at `https://open.cherryin.cc`; model `qwen/qwen3-embedding-8b` |
| **Vector store adapter** (`packages/vector-store`) | Collection CRUD, upsert, query | `chromadb` JS client over HTTP; explicit embeddings (no built-in embed fn) |
| **Chroma sidecar** (`infra/` or root script) | Persistent vector storage process | `npx chroma run --path ./data/chroma` — **required for Node.js** |
| **Config** (`packages/config`) | Env validation, secrets, feature flags | `zod` + `dotenv`; shared across all apps |

## Recommended Project Structure

```
kb-mcp-server/
├── apps/
│   ├── mcp-server/              # stdio + HTTP entrypoints; search tools only
│   │   ├── src/
│   │   │   ├── server.ts        # buildServer(): register tools
│   │   │   ├── stdio.ts         # serveStdio(buildServer)
│   │   │   └── http.ts          # Streamable HTTP / legacy SSE listener
│   │   └── package.json
│   ├── api/                     # REST backend
│   │   ├── src/
│   │   │   ├── routes/          # documents, search, health
│   │   │   └── index.ts
│   │   └── package.json
│   ├── web/                     # Admin UI
│   │   └── src/
│   └── cli/                     # Ingestion CLI
│       └── src/
├── packages/
│   ├── config/                  # Env schema, loadConfig()
│   ├── types/                   # Chunk, Document, SearchResult, CollectionId
│   ├── parsers/                 # txt, md, pdf extractors
│   ├── embeddings/              # CherryIn embedding client
│   ├── vector-store/            # Chroma adapter (ICollectionStore interface)
│   ├── ingestion/               # Chunker + pipeline steps
│   ├── core/                    # SearchService, IngestionService, DocumentRegistry
│   ├── tsconfig/                # Shared TS configs (optional)
│   └── eslint-config/           # Shared lint (optional)
├── infra/
│   └── docker-compose.yml       # Optional: Chroma + api + mcp (later)
├── data/                        # Gitignored: chroma volume, sqlite, uploads
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── .env.example
```

### Structure Rationale

- **`packages/core` before `apps/*`:** Domain logic (search, ingest) is shared by MCP, API, and CLI. Apps are thin transport shells — matches MCP SDK guidance to keep `buildServer()` free of transport concerns ([MCP TypeScript SDK examples](https://github.com/modelcontextprotocol/typescript-sdk)).
- **`packages/vector-store` as adapter:** Chroma JS requires a separate server process ([Chroma docs](https://docs.trychroma.com/docs/run-chroma/clients)); isolating the client behind an interface enables future multi-collection and store swaps without touching MCP or API routes.
- **`packages/ingestion` separate from `packages/parsers`:** Parsing is format-specific and testable; chunking strategy changes frequently in RAG systems ([Ertas AI indexing vs retrieval separation](https://www.ertas.ai/blog/rag-pipeline-architecture-indexing-retrieval)).
- **`apps/mcp-server` retrieval-only:** Aligns with PROJECT.md decision — ingestion stays in admin surfaces; MCP stays fast and simple (contrast [mcp-rag-server](https://github.com/0xrdan/mcp-rag-server) which exposes `index_document` on MCP).
- **`DocumentRegistry` alongside Chroma:** Vector DB holds chunks; a lightweight metadata DB tracks which source files exist, last ingested, and deletion scope. Chroma alone cannot answer "list all documents" cleanly without metadata queries.

## Architectural Patterns

### Pattern 1: Dual Pipeline with Vector Store Contract

**What:** Indexing and retrieval are separate code paths that communicate only through the vector store schema (embedding dims, metadata fields, chunk IDs).

**When to use:** Always — industry standard for RAG ([GenAI Patterns](https://www.genaipatterns.dev/guides/production-search-pipeline), [Ertas AI](https://www.ertas.ai/blog/rag-pipeline-architecture-indexing-retrieval)).

**Trade-offs:** Slightly more packages upfront; enables re-indexing without touching MCP; prevents ingest blocking search.

**Example:**
```typescript
// packages/core/src/search-service.ts
export class SearchService {
  constructor(
    private embedder: EmbeddingClient,
    private store: VectorStore,
  ) {}

  async search(query: string, opts: SearchOptions): Promise<SearchResult[]> {
    const vector = await this.embedder.embedQuery(query);
    return this.store.query({
      collection: opts.collection ?? DEFAULT_COLLECTION,
      embedding: vector,
      topK: opts.topK ?? 10,
      filter: opts.filter,
    });
  }
}

// packages/core/src/ingestion-service.ts — separate path, same store + embedder
export class IngestionService {
  async ingestDocument(doc: ParsedDocument): Promise<IngestReport> {
    const chunks = this.chunker.split(doc);
    const vectors = await this.embedder.embedDocuments(chunks.map(c => c.text));
    await this.store.upsert({ ids: chunks.map(c => c.id), embeddings: vectors, ... });
    await this.registry.markIngested(doc.sourceId);
  }
}
```

### Pattern 2: Transport-Agnostic MCP Server Factory

**What:** One `buildServer()` function registers tools; separate entry files wire stdio vs HTTP transport.

**When to use:** Required when supporting both local Cursor (stdio) and remote SSE/HTTP clients ([MCP architecture](https://modelcontextprotocol.io/docs/learn/architecture)).

**Trade-offs:** Two entrypoints to maintain; zero duplication of tool logic. Prefer **Streamable HTTP** (current MCP recommendation) over legacy dual-endpoint SSE where SDK supports it; keep "SSE" as user-facing alias for HTTP streaming mode.

**Example:**
```typescript
// apps/mcp-server/src/server.ts
import { McpServer } from '@modelcontextprotocol/server';
import { SearchService } from '@kb/core';

export function buildServer(search: SearchService): McpServer {
  const server = new McpServer({ name: 'kb-mcp-server', version: '0.1.0' });
  server.registerTool('search_knowledge', { /* zod schema */ }, async ({ query, topK }) => {
    const results = await search.search(query, { topK });
    return { content: [{ type: 'text', text: formatResults(results) }] };
  });
  return server;
}

// apps/mcp-server/src/stdio.ts — local
// apps/mcp-server/src/http.ts  — remote (createMcpHandler + listen)
```

### Pattern 3: Explicit Embeddings (Bring Your Own Vector)

**What:** Pass pre-computed embeddings to Chroma; do not use Chroma's default embedding functions.

**When to use:** External embedding API (CherryIn/Qwen3) — ensures same model for ingest and query.

**Trade-offs:** Must batch embed calls yourself; full control over model and dimensions.

**Example:**
```typescript
await collection.upsert({
  ids: chunkIds,
  documents: texts,
  embeddings: vectors,  // explicit — embedding_function: null / omitted
  metadatas: metadatas,
});
```

### Pattern 4: Monorepo with Dependency-Ordered Builds

**What:** pnpm workspaces + Turborepo; `dependsOn: ["^build"]` ensures packages build before apps ([Turborepo MCP example discussion](https://github.com/vercel/turborepo/discussions/12938)).

**When to use:** Any multi-package TS project with shared core + multiple entrypoints.

**Trade-offs:** Tooling overhead is modest; pays off immediately when CLI, API, and MCP share `packages/core`.

## Data Flow

### Indexing Flow (Admin → Vector Store)

```
User uploads file (Web / CLI / REST)
    ↓
API validates mime + size → stores raw file (data/uploads/)
    ↓
Parser (packages/parsers) → plain text + structure hints
    ↓
Chunker (packages/ingestion) → Chunk[] with stable ids (hash(sourceId + offset))
    ↓
EmbeddingClient (packages/embeddings) → float[][]  [batched, retry]
    ↓
VectorStore.upsert() → Chroma collection
    ↓
DocumentRegistry.update() → sqlite row (status=indexed, chunkCount, updatedAt)
    ↓
API returns IngestReport { documentId, chunksWritten, durationMs }
```

### Retrieval Flow (MCP / Test Search)

```
MCP client calls search_knowledge({ query, topK })
    ↓
MCP tool handler → SearchService.search(query)
    ↓
EmbeddingClient.embedQuery(query) → query vector  [same model as ingest]
    ↓
VectorStore.query() → Chroma ANN search + metadata
    ↓
Optional: dedupe by parent doc, trim context window
    ↓
Format as MCP text content (title, snippet, score, source path)
    ↓
Return to MCP host → LLM context
```

### State Management

| State | Owner | Storage | Notes |
|-------|-------|---------|-------|
| Document metadata | `DocumentRegistry` | SQLite `./data/registry.db` | Source path, title, ingest status, deleted flag |
| Vector chunks | `VectorStore` | Chroma `./data/chroma/` | ids, embeddings, documents, metadatas |
| Raw uploads | API | Filesystem `./data/uploads/` | Optional; can ingest from path without persisting |
| Config/secrets | All apps | `.env` | CherryIn key, optional API key, Chroma host/port |
| Embedding cache | Optional later | In-memory LRU | Defer to v2; not needed for scaffold |

**Consistency rule:** Delete document → remove registry row + delete Chroma vectors by metadata filter `{ sourceId }`. Re-ingest → upsert with same chunk IDs (idempotent).

### Key Data Flows

1. **Ingestion:** Admin surface → API → IngestionService → parsers → chunker → embedder → Chroma + registry. Long-running; may run async with job status in registry.
2. **MCP search:** Client → transport → tool handler → SearchService → embed query → Chroma query → formatted text. Read-only; no file I/O in MCP layer.
3. **Web test search:** Browser → REST `/search` → same SearchService as MCP — validates parity between admin test and MCP results.

## Suggested Build Order

Dependencies flow bottom-up. Each phase should be vertically testable before the next.

```
Phase 0: Repo scaffold
  pnpm-workspace, turbo, tsconfig, .env.example, scripts/start-chroma

Phase 1: packages/config + packages/types
  ↓
Phase 2: packages/embeddings (CherryIn client, smoke test embed)
  ↓
Phase 3: packages/vector-store (Chroma adapter, upsert/query integration test)
  ↓
Phase 4: packages/parsers + packages/ingestion (chunker)
  ↓
Phase 5: packages/core (DocumentRegistry, IngestionService, SearchService)
  ↓
Phase 6: apps/api (REST: ingest, list, delete, search, health)
  ↓
Phase 7: apps/cli (ingest command — can call API or core directly)
  ↓
Phase 8: apps/mcp-server (stdio first, then HTTP)
  ↓
Phase 9: apps/web (upload, list, test search)
```

| Step | Delivers | Blocked by | Unblocks |
|------|----------|------------|----------|
| 1. Config + types | Shared env contract | — | Everything |
| 2. Embeddings | Working Qwen3 vectors | Config | Ingest + search |
| 3. Vector store | Chroma upsert/query | Embeddings (for dim validation) | Core services |
| 4. Parsers + chunker | Text chunks from files | Types | IngestionService |
| 5. Core services | End-to-end ingest + search in Node script | 2–4 | All apps |
| 6. REST API | HTTP admin + ingest | Core | Web, CLI |
| 7. CLI | Terminal ingest | Core or API | DX, CI ingest |
| 8. MCP server | Cursor search tool | SearchService | Core value |
| 9. Web admin | Visual admin | REST API | Full scaffold |

**Rationale:** MCP is the core value proposition but depends on a working search path (embed + Chroma). Building API/CLI before MCP validates ingestion without transport complexity. Stdio MCP before HTTP reduces debugging surface ([stdio transport spec](https://modelcontextprotocol.io/specification/draft/basic/transports/stdio)).

**Parallelization opportunity:** After Phase 5, `apps/cli` and `apps/api` can proceed in parallel; `apps/web` waits on API; `apps/mcp-server` can start once `SearchService` exists (parallel with API).

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **Single developer (v1 scaffold)** | Monorepo, one Chroma process, SQLite registry, sync ingest acceptable |
| **Small team / CI ingest** | Async ingest queue (BullMQ or in-process job table); batch embeddings |
| **Multi-machine** | Chroma server mode already HTTP; run Chroma on host with volume; MCP Streamable HTTP behind auth |
| **Many collections** | Extend `VectorStore` interface with `collectionId`; registry tracks collection per doc |

### Scaling Priorities

1. **First bottleneck:** CherryIn embedding API latency/rate limits during bulk ingest — batch requests, exponential backoff, optional concurrency limit.
2. **Second bottleneck:** Chroma single-node write throughput — serialize ingests or queue; reads (search) scale better than writes.

For this scaffold, do not pre-build queues or caches — the dual-pipeline separation is the architectural investment that makes them easy to add later.

## Anti-Patterns

### Anti-Pattern 1: Ingestion Tools on MCP

**What people do:** Expose `index_document`, `upload_file` as MCP tools ([mcp-rag-server](https://github.com/0xrdan/mcp-rag-server) pattern).

**Why it's wrong for this project:** Couples slow I/O and embedding to the AI session; complicates auth; bloats tool surface. PROJECT.md explicitly rejects this.

**Do this instead:** MCP exposes `search_knowledge` (and optionally `get_document_stats`). All writes go through REST/CLI/Web.

### Anti-Pattern 2: Embedding Logic Duplicated in MCP and API

**What people do:** Copy-paste Chroma query code into MCP tool handlers and API routes.

**Why it's wrong:** Model/collection/filter drift; double maintenance; test gaps.

**Do this instead:** Single `SearchService` in `packages/core`; MCP and API are thin wrappers.

### Anti-Pattern 3: Multiple Processes Writing One Chroma Path

**What people do:** Run embedded Chroma from MCP and API simultaneously (Python `PersistentClient` mental model).

**Why it's wrong:** Chroma is **not process-safe** for embedded/local SQLite ([Chroma deployment patterns](https://cookbook.chromadb.dev/running/deployment-patterns/)). Node.js has no in-process persistent client — requires HTTP server.

**Do this instead:** One `chroma run --path ./data/chroma` sidecar; all packages use `ChromaClient` over HTTP.

### Anti-Pattern 4: Transport Logic Inside Tool Handlers

**What people do:** `if (stdio) { ... } else { ... }` inside tool implementations.

**Why it's wrong:** Violates MCP layer separation; untestable tools.

**Do this instead:** Tools call domain services only; transport selection lives in entrypoint files.

### Anti-Pattern 5: Monolithic `apps/server` Package

**What people do:** Single package with MCP + Express + React + ingest logic.

**Why it's wrong:** Hard to deploy MCP as subprocess while running web server; couples release cycles.

**Do this instead:** Separate apps with shared `packages/core` — matches [Knowledge Plane](https://github.com/camplight/knowledgeplane) and Turborepo MCP examples.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **CherryIn (Qwen3 embed)** | OpenAI-compatible REST via `openai` SDK | Same client for `embeddings.create` on ingest batches and query; store `dimensions` in config |
| **Chroma** | HTTP client to local `chroma run` | Default `localhost:8000`; path persisted via `--path`; not embedded in Node |
| **MCP clients (Cursor)** | stdio subprocess spawn | Point to `apps/mcp-server/dist/stdio.js`; logs to stderr only |
| **Remote MCP clients** | Streamable HTTP / SSE on fixed port | Optional bearer token via env; separate from backend API key |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Web ↔ API | REST JSON | CORS for localhost; optional `X-API-Key` |
| CLI ↔ Core/API | Direct import or HTTP | Direct import faster for local; HTTP matches production |
| MCP ↔ Core | In-process `SearchService` | No HTTP hop for local stdio latency |
| API/MCP ↔ Chroma | HTTP via `vector-store` adapter | Single Chroma instance |
| Ingestion ↔ Registry | SQLite transactions | Registry updated after successful Chroma upsert |
| All apps ↔ Config | `loadConfig()` at startup | Fail fast on missing `CHERRYIN_API_KEY` |

## Sources

- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture) — client-server model, stdio vs Streamable HTTP, layer separation (HIGH)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — `buildServer()`, `serveStdio`, HTTP handler pattern via Context7 (HIGH)
- [MCP stdio transport spec](https://modelcontextprotocol.io/specification/draft/basic/transports/stdio) — subprocess model, stderr logging (HIGH)
- [Chroma Clients docs](https://docs.trychroma.com/docs/run-chroma/clients) — Node requires server process, `npx chroma run --path` (HIGH)
- [Chroma Deployment Patterns](https://cookbook.chromadb.dev/running/deployment-patterns/) — embedded vs server, process-safety (HIGH)
- [Knowledge Plane](https://github.com/camplight/knowledgeplane) — monorepo apps/packages layout for MCP + REST + web (MEDIUM)
- [RAG indexing vs retrieval separation](https://www.ertas.ai/blog/rag-pipeline-architecture-indexing-retrieval) — dual pipeline pattern (MEDIUM)
- [Production search pipeline composition](https://www.genaipatterns.dev/guides/production-search-pipeline) — ingest vs query halves (MEDIUM)
- [Turborepo MCP monorepo discussion](https://github.com/vercel/turborepo/discussions/12938) — pnpm workspace structure for MCP servers (MEDIUM)
- [mcp-rag-server](https://github.com/0xrdan/mcp-rag-server) — Chroma + MCP tool surface (contrast example) (MEDIUM)
- [knowledge-mcp-server](https://github.com/shoyu-ramen/knowledge-mcp-server) — engine vs server separation (MEDIUM)

---
*Architecture research for: kb-mcp-server greenfield scaffold*
*Researched: 2026-06-29*
