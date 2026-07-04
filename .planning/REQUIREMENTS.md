# Requirements: kb-mcp-server

**Defined:** 2026-06-29
**Core Value:** An MCP client can reliably semantic-search ingested documents through a stable tool interface.

## v1 Requirements

### MCP Retrieval

- [ ] **MCP-01**: MCP client can connect via stdio transport and invoke tools
- [ ] **MCP-02**: MCP client can connect via SSE/HTTP transport and invoke the same tools
- [ ] **MCP-03**: User can semantic-search the knowledge base via `search_knowledge` tool with ranked results
- [ ] **MCP-04**: Search results include score, text snippet, document ID, filename, and chunk index
- [ ] **MCP-05**: MCP server exposes retrieval tools only (no upload/delete/index tools)
- [ ] **MCP-06**: MCP search responses are bounded (configurable top_k with safe defaults and truncated snippets)

### Ingestion & Storage

- [x] **INGE-01**: Operator can ingest txt files into the vector knowledge base
- [x] **INGE-02**: Operator can ingest markdown files into the vector knowledge base
- [x] **INGE-03**: Operator can ingest text-layer PDF files into the vector knowledge base
- [x] **INGE-04**: System rejects PDFs with insufficient extractable text (no OCR)
- [x] **INGE-05**: Ingested documents are chunked with configurable size and overlap
- [x] **INGE-06**: Chunks are embedded via CherryIn API using `qwen/qwen3-embedding-8b`
- [x] **INGE-07**: Vectors persist in local Chroma and survive process restart
- [x] **INGE-08**: Re-ingesting a document replaces prior chunks without orphan vectors
- [x] **INGE-09**: Default single collection is used with optional `collection` parameter reserved for future multi-collection support

### Backend API

- [x] **API-01**: Operator can upload documents via REST API for ingestion
- [x] **API-02**: Operator can list indexed documents via REST API
- [x] **API-03**: Operator can delete a document and its vectors via REST API
- [x] **API-04**: Operator can run test semantic search via REST API (same query path as MCP)
- [x] **API-05**: Backend exposes health/status endpoints for Chroma and embedding connectivity

### Web Admin

- [ ] **WEB-01**: Operator can upload txt, markdown, and text-layer PDF files via web UI
- [ ] **WEB-02**: Operator can view list of indexed documents and ingestion status via web UI
- [ ] **WEB-03**: Operator can delete documents via web UI
- [ ] **WEB-04**: Operator can run test search and view ranked results via web UI

### CLI

- [ ] **CLI-01**: Operator can ingest files or directories from the command line
- [ ] **CLI-02**: Operator can list and delete documents from the command line

### Configuration & Security

- [x] **CONF-01**: All secrets and service URLs load from environment variables / `.env` (never committed)
- [x] **CONF-02**: `.env.example` documents required configuration without secrets
- [x] **CONF-03**: Optional API key authentication can be enabled via environment variable
- [x] **CONF-04**: When auth is disabled, backend binds to localhost-friendly dev defaults

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Retrieval Enhancements

- **RETR-01**: Hybrid BM25 + semantic search with reciprocal rank fusion
- **RETR-02**: Cross-encoder reranking on search results
- **RETR-03**: MCP `read_around` / `read_file` tools for context expansion after search

### Platform

- **PLAT-01**: Multiple named collections with collection-scoped search and ingest
- **PLAT-02**: Incremental re-index (skip unchanged files)
- **PLAT-03**: Async job queue for large batch ingestion

## Out of Scope

| Feature | Reason |
|---------|--------|
| OCR / scanned PDF | v1 text-layer PDF only; reduces complexity |
| Upload/CRUD via MCP tools | Retrieval-only MCP; admin surfaces handle writes |
| Built-in LLM Q&A (`ask` tool) | Client LLM synthesizes from search results |
| Multi-tenant RBAC | Personal/dev scaffold; optional single API key only |
| Hosted vector DB (Qdrant Cloud, pgvector cluster) | Local-first Chroma sidecar |
| Real-time file watchers | Explicit ingest only; avoids race conditions |
| Web scraping / GitHub repo indexing | External fetch complexity and policy risk |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MCP-01 | Phase 3 | Pending |
| MCP-02 | Phase 3 | Pending |
| MCP-03 | Phase 3 | Pending |
| MCP-04 | Phase 3 | Pending |
| MCP-05 | Phase 3 | Pending |
| MCP-06 | Phase 3 | Pending |
| INGE-01 | Phase 1 | Complete |
| INGE-02 | Phase 1 | Complete |
| INGE-03 | Phase 1 | Complete |
| INGE-04 | Phase 1 | Complete |
| INGE-05 | Phase 1 | Complete |
| INGE-06 | Phase 1 | Complete |
| INGE-07 | Phase 1 | Complete |
| INGE-08 | Phase 1 | Complete |
| INGE-09 | Phase 1 | Complete |
| API-01 | Phase 2 | Complete |
| API-02 | Phase 2 | Complete |
| API-03 | Phase 2 | Complete |
| API-04 | Phase 2 | Complete |
| API-05 | Phase 1 | Complete |
| WEB-01 | Phase 4 | Pending |
| WEB-02 | Phase 4 | Pending |
| WEB-03 | Phase 4 | Pending |
| WEB-04 | Phase 4 | Pending |
| CLI-01 | Phase 4 | Pending |
| CLI-02 | Phase 4 | Pending |
| CONF-01 | Phase 1 | Complete |
| CONF-02 | Phase 1 | Complete |
| CONF-03 | Phase 4 | Complete |
| CONF-04 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-29*
*Last updated: 2026-06-29 after roadmap creation*
