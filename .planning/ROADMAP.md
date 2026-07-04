# Roadmap: kb-mcp-server

**Core Value:** An MCP client can reliably semantic-search ingested documents through a stable tool interface.

**Granularity:** coarse (4 phases)

## Phases

- [x] **Phase 1: Platform Foundation & Ingestion** - Monorepo, config, Chroma sidecar, and full ingest pipeline into persistent vectors
 (completed 2026-07-01)

- [x] **Phase 2: REST Backend & Search** - Document CRUD and test search via Fastify REST using shared SearchService
 (completed 2026-07-01)

- [x] **Phase 3: MCP Search Server** - stdio and Streamable HTTP transports exposing bounded retrieval-only search tools
 (completed 2026-07-04)
- [ ] **Phase 4: Admin Surfaces & Security** - Web admin, CLI, and optional API key auth with localhost dev defaults

## Phase Details

### Phase 1: Platform Foundation & Ingestion

**Goal:** Operators can run the local stack and ingest documents into a persistent vector knowledge base with validated parsing and embedding.

**Depends on:** Nothing (first phase)

**Requirements:** CONF-01, CONF-02, CONF-04, INGE-01, INGE-02, INGE-03, INGE-04, INGE-05, INGE-06, INGE-07, INGE-08, INGE-09, API-05

**Success Criteria** (what must be TRUE):

1. Operator can clone the repo, copy `.env.example` to `.env`, start the dev stack (including Chroma sidecar), and see healthy status for Chroma and embedding connectivity
2. Operator can ingest txt, markdown, and text-layer PDF files; PDFs with insufficient extractable text are rejected with a clear error
3. Ingested chunks are embedded via CherryIn (`qwen/qwen3-embedding-8b`), stored in local Chroma, and survive process restart
4. Re-ingesting a document replaces prior chunks without orphan vectors; default single collection is used with optional `collection` parameter reserved for future use
5. All secrets and service URLs load from environment / `.env` (never committed); backend uses localhost-friendly dev defaults when auth is disabled

**Plans:** 3/3 plans complete

Plans:

- [x] 01-01-PLAN.md — Monorepo scaffold, Zod config, .env.example, Chroma wait script
- [x] 01-02-PLAN.md — SQLite registry, ChunkConfig, EmbeddingClient, ChromaVectorStore, token chunker
- [x] 01-03-PLAN.md — Parsers, IngestionService, health backend, ingest CLI, dev orchestration

**Research flags:** CherryIn API batch/rate limits and Qwen3 retrieval prefix — validate during planning

---

### Phase 2: REST Backend & Search

**Goal:** Operators can manage the document corpus and run test semantic search through a REST API backed by shared core services.

**Depends on:** Phase 1

**Requirements:** API-01, API-02, API-03, API-04

**Success Criteria** (what must be TRUE):

1. Operator can upload txt, markdown, and text-layer PDF documents via REST and they become searchable after ingestion completes
2. Operator can list indexed documents and delete a document along with its vectors via REST
3. Operator can run test semantic search via REST and receive ranked results with score, text snippet, document ID, filename, and chunk index
4. REST search uses the same SearchService query path that MCP will call — results are consistent across admin and retrieval surfaces

**Plans:** 3/3 plans complete

Plans:

- [x] 02-01-PLAN.md — ChromaVectorStore.query(), SearchService, unit tests (API-04 core)
- [x] 02-02-PLAN.md — Backend bootstrap: Zod provider, Swagger /docs, multipart, service wiring
- [x] 02-03-PLAN.md — REST routes documents + search (API-01–04), E2E checkpoint

---

### Phase 3: MCP Search Server

**Goal:** MCP clients can semantically search the knowledge base via stdio and Streamable HTTP using a stable, retrieval-only tool interface.

**Depends on:** Phase 2

**Requirements:** MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06

**Success Criteria** (what must be TRUE):

1. MCP client can connect via stdio transport, invoke `search_knowledge`, and receive ranked semantic results
2. MCP client can connect via Streamable HTTP transport and invoke the same tools with identical schemas and behavior
3. Search results include score, text snippet, document ID, filename, and chunk index
4. MCP server exposes retrieval tools only — no upload, delete, or index tools
5. Search responses are bounded with configurable top_k, safe defaults, and truncated snippets; stdio entrypoint logs to stderr only (no stdout pollution)

**Plans:** 3/3 plans complete

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — MCP scaffold, createMcpServices(), buildMcpServer(), search_knowledge, unit tests (MCP-03–06)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — stdio entrypoint, stderr-only logging, kb-mcp-server bin (MCP-01)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 03-03-PLAN.md — Streamable HTTP at POST /mcp, config env, dev script, route tests, E2E checkpoint (MCP-02)

---

### Phase 4: Admin Surfaces & Security

**Goal:** Operators can administer the knowledge base via web UI and CLI; optional API key auth hardens exposure when enabled.

**Depends on:** Phase 2 (REST API); Phase 3 recommended before shipping but not blocking web/CLI against REST

**Requirements:** WEB-01, WEB-02, WEB-03, WEB-04, CLI-01, CLI-02, CONF-03

**Success Criteria** (what must be TRUE):

1. Operator can upload txt, markdown, and text-layer PDF files via the web admin UI
2. Operator can view indexed documents with ingestion status, delete documents, and run test search with ranked results in the web UI
3. Operator can ingest files or directories and list/delete documents from the command line
4. When optional API key auth is enabled via environment variable, backend rejects unauthenticated requests; web and CLI respect the same auth configuration
5. Web and CLI reflect the same document state as REST — no divergent corpus views

**Plans:** 4 plans

Plans:

**Wave 1**

- [ ] 04-01-PLAN.md — CONF-03 optional bearer auth: config, @fastify/bearer-auth, route preHandlers, tests

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 04-02-PLAN.md — CLI-01, CLI-02: Commander apps/cli, ingest/list/delete, REST client with Bearer

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 04-03-PLAN.md — WEB-01–04: Vite/React admin SPA and UI components per UI-SPEC

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 04-04-PLAN.md — Static serve, dev orchestration, turbo build order, E2E checkpoint

**UI hint:** yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Platform Foundation & Ingestion | 3/3 | Complete    | 2026-07-01 |
| 2. REST Backend & Search | 3/3 | Complete    | 2026-07-01 |
| 3. MCP Search Server | 3/3 | Complete | 2026-07-04 |
| 4. Admin Surfaces & Security | 0/4 | Not started | - |

## Coverage

| Category | Requirements | Phase |
|----------|--------------|-------|
| Configuration & Security | CONF-01, CONF-02, CONF-04 | 1 |
| Configuration & Security | CONF-03 | 4 |
| Ingestion & Storage | INGE-01 – INGE-09 | 1 |
| Backend API | API-05 | 1 |
| Backend API | API-01 – API-04 | 2 |
| MCP Retrieval | MCP-01 – MCP-06 | 3 |
| Web Admin | WEB-01 – WEB-04 | 4 |
| CLI | CLI-01, CLI-02 | 4 |

**Mapped:** 30/30 v1 requirements ✓

---
*Roadmap created: 2026-06-29*
*Granularity: coarse — 4 phases derived from requirements and research build order*
