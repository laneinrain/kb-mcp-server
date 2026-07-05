# Requirements: kb-mcp-server

**Defined:** 2026-07-05
**Milestone:** v1.1 MCP Context Tools
**Core Value:** An MCP client can reliably semantic-search ingested documents through a stable tool interface.

## v1.1 Requirements

### MCP Context Retrieval

- [x] **MCP-07**: MCP client can invoke `read_around` with `document_id`, `chunk_index`, and optional `window` to retrieve neighboring chunk texts from the same document
- [x] **MCP-08**: MCP client can invoke `read_file` with `document_id` to retrieve document content (all chunks in order, with safe size bounds)
- [x] **MCP-09**: `read_around` and `read_file` responses are bounded (configurable max chunks/chars, safe defaults) and include document metadata (filename, chunk indices)
- [x] **MCP-10**: New read tools are available on stdio and Streamable HTTP transports with identical schemas and behavior as `search_knowledge`
- [x] **MCP-11**: MCP server exposes retrieval tools only — read tools do not mutate index or corpus

### Core Services

- [x] **CORE-01**: Context retrieval reads chunk text from the same Chroma collection and document registry as `SearchService` (no divergent corpus)
- [x] **CORE-02**: Invalid or unknown `document_id` / out-of-range `chunk_index` returns clear errors without partial data

## Future Requirements

Deferred beyond v1.1. Tracked but not in current roadmap.

### Retrieval Enhancements

- **RETR-01**: Hybrid BM25 + semantic search with reciprocal rank fusion
- **RETR-02**: Cross-encoder reranking on search results

### Platform

- **PLAT-01**: Multiple named collections with collection-scoped search and ingest
- **PLAT-02**: Incremental re-index (skip unchanged files)
- **PLAT-03**: Async job queue for large batch ingestion

### Admin / REST parity (optional later)

- **API-06**: REST endpoints for read_around / read_file (admin test parity)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Hybrid BM25 / rerank | v1.1 is context expansion only; search algorithm unchanged |
| OCR / scanned PDF | Still text-layer PDF only |
| Upload/CRUD via MCP | Retrieval-only MCP; writes stay on admin surfaces |
| Multi-collection UI | PLAT-01 deferred; read tools use same collection param as search |
| Full document unbounded return | Must enforce char/chunk limits to protect MCP clients |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 5 | Complete (05-01, 05-02) |
| CORE-02 | Phase 5 | Complete (05-02) |
| MCP-07 | Phase 6 | Complete (06-01) |
| MCP-08 | Phase 6 | Complete (06-01) |
| MCP-09 | Phase 6 | Complete (06-01) |
| MCP-10 | Phase 6 | Complete (06-02) |
| MCP-11 | Phase 6 | Complete (06-01) |

**Coverage:**
- v1.1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-05*
*Last updated: 2026-07-05 for milestone v1.1*
