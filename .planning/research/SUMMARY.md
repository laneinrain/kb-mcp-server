# Project Research Summary

**Project:** kb-mcp-server
**Domain:** TypeScript/Node knowledge-base MCP server (local-first RAG scaffold)
**Researched:** 2026-06-29
**Confidence:** HIGH

## Executive Summary

kb-mcp-server is a **local-first RAG scaffold** that exposes semantic search to AI clients via MCP while keeping document ingestion in separate admin surfaces (REST, web UI, CLI). Experts build these systems as **dual pipelines**: an offline indexing path (parse → chunk → embed → store) and an online retrieval path (query → embed → search → format), with the vector store as the contract boundary between them. MCP is a thin transport layer over retrieval only — not a second ingestion channel.

The recommended approach is a **pnpm + Turborepo monorepo** with shared domain logic in `packages/core` (SearchService, IngestionService, DocumentRegistry) and thin app shells for MCP, Fastify REST, Vite/React admin, and Commander CLI. **Chroma runs as a sidecar HTTP server** (`npx chroma run --path ./data/chroma`); the JS client is REST-only and must receive **precomputed embeddings** from CherryIn's OpenAI-compatible API (`qwen/qwen3-embedding-8b`, fixed 1024 dimensions). MCP uses `@modelcontextprotocol/sdk@1.29` with a single `buildServer()` factory shared by stdio and SSE/HTTP entrypoints. This architecture deliberately diverges from most OSS competitors by keeping MCP to 1–2 search tools and routing all writes through the backend.

The main risks are **data-plane correctness**, not framework choice: stdout pollution breaks stdio MCP; multiple processes on one Chroma path corrupts the index; embedding model drift between ingest and query silently degrades search; scanned PDFs produce ghost vectors; unstable chunk IDs leave orphans on re-ingest. Mitigate by enforcing Chroma server mode from day one, a single shared embedding module, PDF text validation, stable `{document_id}:{chunk_index}` IDs with delete-before-upsert semantics, stderr-only logging in MCP stdio, and bounded tool responses (default top_k 3–5, truncated snippets).

## Key Findings

### Recommended Stack

Node 24 LTS, TypeScript 6, pnpm 11, and Turborepo 2 form the monorepo foundation. Domain logic lives in `packages/core` with `packages/config` for Zod-validated env; apps are transport shells only. Fastify 5 is the greenfield REST default (schema validation, Pino logging). Chroma 3.4 sidecar + `chromadb` JS client handles vectors; CherryIn embeddings via `openai` SDK with explicit `baseURL` and fixed dimensions. MCP uses stable SDK v1.29 (not v2 alpha). Admin UI is Vite 8 + React 19; CLI uses Commander 15. Document metadata goes in `better-sqlite3`, not Chroma alone.

**Core technologies:**
- **Node 24 + TypeScript 6 + pnpm + Turborepo:** Active LTS runtime with cached monorepo builds across `apps/*` and `packages/*`
- **@modelcontextprotocol/sdk 1.29:** stdio for Cursor local + Streamable HTTP/SSE for remote; single `McpServer` factory
- **Fastify 5.9 + Zod:** REST ingest/CRUD/search with typed validation via `fastify-type-provider-zod`
- **Chroma sidecar + chromadb 3.4:** Local persistent vectors; all clients connect via HTTP; explicit embeddings only
- **openai SDK 6.45 → CherryIn:** `qwen/qwen3-embedding-8b` at 1024 dims, cosine distance, same client for ingest and query
- **better-sqlite3:** Document registry (list, status, delete scope) alongside Chroma chunks
- **@langchain/textsplitters + pdf-parse + gray-matter:** Chunking and text-layer PDF/markdown parsing without full LangChain

### Expected Features

v1 validates one loop: *MCP client reliably semantic-searches ingested documents.* Table stakes include `search_knowledge` with source attribution (score, snippet, document ID, chunk index), stdio + SSE transports, full ingest pipeline for txt/md/text-layer PDF, Chroma persistence, REST CRUD + search, web admin (upload/list/test search), CLI ingest, env-based config, and optional API key auth (off by default).

**Must have (table stakes):**
- **`search_knowledge` MCP tool** — ranked chunks with citation metadata; core product contract
- **MCP stdio + SSE** — local IDE and remote client support
- **Ingestion pipeline + Chroma persistence** — upload → chunk → embed → store; survives restart
- **REST + Web + CLI admin trifecta** — ingestion stays off MCP (project differentiator)
- **Document list/delete/re-index + test search** — operators must see and manage corpus
- **Env config + optional API key** — CherryIn key, Chroma path, auth flag; localhost dev without auth

**Should have (competitive):**
- **Retrieval-only MCP surface** — 1–2 search tools; no upload/CRUD on MCP (security + token efficiency)
- **Single default collection, multi-collection-ready APIs** — optional `collection` param defaulting to `"default"`
- **Shared search path** — admin test search and MCP call the same SearchService

**Defer (v2+):**
- **Hybrid BM25 + semantic search, reranking** — validate pure semantic first
- **`read_around` / `read_file` MCP tools** — valuable v1.x addition after core search works
- **Multi-tenant auth, OCR, grounded `ask` tool, hosted vector DBs** — explicitly out of scope

### Architecture Approach

Follow the **dual-pipeline RAG layout** with transport-agnostic MCP: indexing flows through admin surfaces → IngestionService → parsers → chunker → embedder → Chroma + SQLite registry; retrieval flows through MCP or REST test-search → SearchService → query embed → Chroma query → formatted results. Apps never duplicate Chroma or embedding logic.

**Major components:**
1. **`packages/core`** — SearchService, IngestionService, DocumentRegistry; single source of truth for ingest and query
2. **`apps/mcp-server`** — `buildServer()` + stdio/HTTP entrypoints; retrieval tools only
3. **`apps/backend` (api)** — Fastify REST for upload, list, delete, search, health; optional bearer auth
4. **`apps/web` + `apps/cli`** — Admin UI and terminal ingest; clients of REST or core directly
5. **Chroma sidecar + SQLite registry** — Vectors in Chroma; document catalog and ingest status in SQLite

### Critical Pitfalls

1. **Stdout pollution breaks stdio MCP** — Ban stdout logging in stdio entrypoint; use stderr only; audit dependencies before Phase 4 MCP
2. **Multiple processes on one Chroma path** — Run Chroma in server mode; all components use HTTP client; never embedded multi-writer
3. **Query vs index embedding mismatch** — Single shared embedding module; store model + dim in collection metadata; model change = new collection + full re-embed
4. **Scanned PDF ghost vectors** — Reject PDFs with insufficient extracted text; fail fast with clear error in admin
5. **Unstable chunk IDs / orphan vectors** — Use `{document_id}:{chunk_index}`; delete all vectors for document before re-upsert; registry tracks chunk IDs
6. **Unbounded MCP search payloads** — Cap top_k (default 3–5, max 10); truncate snippets; return metadata not full chunk bodies
7. **Divergent stdio and SSE implementations** — Single `buildServer()` factory from day one; schema parity tests across transports

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Monorepo Scaffold & Config
**Rationale:** Everything depends on workspace layout, shared env contract, and dev orchestration including Chroma sidecar startup.
**Delivers:** pnpm workspace, Turborepo pipeline, `packages/config` (Zod env schema), `packages/types`, `.env.example`, `pnpm dev` with Chroma via concurrently, Node 24 pin.
**Addresses:** Env-based configuration, secrets hygiene.
**Avoids:** Ad-hoc env parsing duplicated across apps later.

### Phase 2: Embedding & Chroma Foundation
**Rationale:** Pitfalls research insists Chroma deployment mode and embedding client must be correct **before any data is written**; wrong choices force full re-index.
**Delivers:** CherryIn embedding client (batch, retry, fixed 1024 dims), Chroma HTTP adapter with typed upsert/query requiring explicit embeddings, collection init with metadata (`embedding_model`, `embedding_dim`), health checks.
**Addresses:** Chroma persistence, embedding generation on ingest.
**Avoids:** Multi-process Chroma corruption (Pitfall 2), embedding mismatch (Pitfall 3), missing explicit embeddings (Pitfall 10).

### Phase 3: Ingestion Pipeline
**Rationale:** MCP search is useless without validated indexed content; chunk ID strategy and PDF validation must exist before retrieval testing.
**Delivers:** Parsers (txt/md/pdf-text), chunker with configurable size/overlap, DocumentRegistry (SQLite), IngestionService with stable IDs, delete-by-document, staged pipeline with retry on 429, PDF empty-text rejection.
**Addresses:** Document ingestion, delete/re-index, source attribution metadata, configurable chunking.
**Avoids:** Scanned PDF ghosts (Pitfall 4), unstable chunk IDs (Pitfall 8), partial ingest without recovery (Pitfall 9).

### Phase 4: Core Services & REST API
**Rationale:** REST is the contract for web and CLI; SearchService must be proven before MCP transport complexity.
**Delivers:** SearchService (shared with future MCP), Fastify routes (upload, list, delete, search, health), multipart uploads, OpenAPI via Swagger.
**Addresses:** Backend REST API, document list, test search endpoint, document CRUD.
**Avoids:** Admin/MCP search divergence (UX pitfall); ingestion on MCP (Pitfall 5 — scope guard for MCP phase).

### Phase 5: MCP Search Server (stdio)
**Rationale:** Core value proposition, but depends on working SearchService; stdio first reduces debugging surface per MCP spec guidance.
**Delivers:** `buildServer()` factory, `search_knowledge` tool with Zod schema, stdio entrypoint, bounded responses (top_k cap, snippets), stderr-only logging.
**Addresses:** Semantic search MCP tool, MCP stdio transport, clear tool descriptions.
**Avoids:** Stdout pollution (Pitfall 1), unbounded payloads (Pitfall 6), ingestion on MCP (Pitfall 5).

### Phase 6: MCP SSE / HTTP Transport
**Rationale:** Shared factory proven on stdio before adding HTTP session lifecycle, CORS, and proxy concerns.
**Delivers:** SSE/Streamable HTTP entrypoint reusing `buildServer()`, localhost bind default, schema parity test vs stdio.
**Addresses:** MCP SSE transport for remote clients.
**Avoids:** Divergent transport implementations (Pitfall 7).

### Phase 7: Web Admin & CLI
**Rationale:** Both depend on REST API; can proceed in parallel once Phase 4 completes.
**Delivers:** Vite/React admin (upload, document list, test search calling same SearchService path), Commander CLI (ingest file/dir, list docs).
**Addresses:** Web admin trifecta, CLI ingest, test search in admin.
**Avoids:** Re-ingest duplicates (admin should surface replace semantics).

### Phase 8: Optional Auth & Hardening
**Rationale:** Auth does not fix data-plane pitfalls; add exposure controls only after core search path is verified.
**Delivers:** `@fastify/bearer-auth` when `API_KEY` set, bind MCP HTTP to 127.0.0.1, startup probes (Chroma heartbeat + embed smoke test), `.env.example` and secret hygiene docs.
**Addresses:** Optional API key auth (env-gated, off by default).
**Avoids:** MCP SSE bound to 0.0.0.0 without auth (security mistake).

### Phase Ordering Rationale

- **Bottom-up dependency flow:** config → embeddings/Chroma → ingestion → core/REST → MCP → admin surfaces → hardening
- **Chroma server mode in Phase 2** prevents the most expensive mistake (index corruption requiring full re-ingest)
- **Ingestion before MCP** ensures search tests hit real content, not empty collections
- **stdio MCP before SSE** isolates transport bugs from domain logic
- **REST before web/CLI** establishes API contracts that keep admin and MCP consistent
- **Auth last** — personal localhost scaffold defaults to zero-config dev

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** CherryIn API quirks (batch limits, rate limits, instruction prefix for Qwen3 retrieval) — provider not independently verified at HIGH confidence
- **Phase 3:** pdf-parse failure modes on edge-case PDFs; chunk size defaults for code vs prose
- **Phase 6:** Streamable HTTP vs legacy SSE in SDK 1.29 — PROJECT.md requires SSE; confirm SDK-supported path and proxy/heartbeat config

Phases with standard patterns (skip `/gsd-research-phase`):
- **Phase 1:** pnpm + Turborepo + Zod config — well-documented, Turborepo has MCP monorepo precedent
- **Phase 4:** Fastify REST with multipart — established patterns
- **Phase 7:** Vite/React admin calling REST — standard SPA scaffold

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | MCP SDK, Chroma, Fastify, npm versions verified 2026-06-29; monorepo layout is MEDIUM precedent but strongly recommended |
| Features | HIGH | MCP spec + multiple OSS competitors analyzed; admin UX from adjacent RAG platforms at MEDIUM |
| Architecture | HIGH | Dual-pipeline RAG and transport-agnostic MCP validated by MCP spec + reference implementations |
| Pitfalls | HIGH | MCP SDK docs, Chroma deployment docs, RAG post-mortems; CherryIn-specific quirks at MEDIUM |

**Overall confidence:** HIGH

### Gaps to Address

- **CherryIn API behavior:** Validate batch size limits, rate limits, and whether Qwen3 retrieval instruction prefix is required — smoke test in Phase 2 planning
- **Monorepo package granularity:** STACK recommends `packages/core` only; ARCHITECTURE suggests finer split (`parsers`, `embeddings`, `vector-store`) — decide during Phase 1 planning (start simpler, extract when needed)
- **SSE vs Streamable HTTP naming:** PROJECT.md says SSE; MCP spec deprecates legacy SSE — implement via SDK-supported HTTP streaming path and document alias for users
- **Exact chunk defaults:** Research cites 800–2400 chars with overlap; tune during Phase 3 with sample corpus from user's actual docs

## Sources

### Primary (HIGH confidence)
- [MCP TypeScript SDK server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — transports, stderr logging, Streamable HTTP
- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-03-26/server/tools) — tool schema, security
- [Chroma clients docs](https://docs.trychroma.com/docs/run-chroma/clients) — JS requires server; precomputed embeddings
- [Chroma deployment patterns](https://cookbook.chromadb.dev/running/deployment-patterns/) — process safety, embedded vs server
- [npm registry](https://www.npmjs.com/) — version pins verified 2026-06-29
- [Node.js Release LTS schedule](https://github.com/nodejs/Release) — Node 24 Active LTS
- PROJECT.md — explicit scope, decisions, out-of-scope items

### Secondary (MEDIUM confidence)
- [Knowledge Plane](https://github.com/camplight/knowledgeplane) — monorepo MCP + REST + web precedent
- [knowledgestack/ks-mcp](https://github.com/knowledgestack/ks-mcp), [mcp-rag-server](https://github.com/Daniel-Barta/mcp-rag-server), [MODULAR-RAG-MCP-SERVER](https://github.com/nobitalqs/MODULAR-RAG-MCP-SERVER) — competitor feature analysis
- [Turborepo MCP monorepo discussion](https://github.com/vercel/turborepo/discussions/12938) — workspace layout
- [Qwen3-Embedding-8B model card](https://huggingface.co/Qwen/Qwen3-Embedding-8B) — dimensions, MRL
- [RAG indexing vs retrieval separation](https://www.ertas.ai/blog/rag-pipeline-architecture-indexing-retrieval) — dual pipeline pattern

### Tertiary (LOW confidence)
- CherryIn OpenAI-compatible API specifics — assumed per PROJECT.md; needs Phase 2 validation
- [Albino Geek MCP production gotchas](https://www.albinogeek.com/posts/mcp-5-production-gotchas) — stdout/concurrency patterns

---
*Research completed: 2026-06-29*
*Ready for roadmap: yes*
