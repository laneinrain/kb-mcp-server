# Feature Research

**Domain:** Knowledge-base MCP server (RAG retrieval for AI clients)
**Researched:** 2026-06-29
**Confidence:** HIGH (MCP spec + multiple open-source competitors verified); MEDIUM (admin UX norms from adjacent RAG platforms)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist when they install a "knowledge base MCP server." Missing these makes the product feel broken or unusable in Cursor/Claude Desktop workflows.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Semantic search MCP tool** (`search_knowledge` / `rag_query`) | Every KB MCP product exposes at least one search tool; this is the core contract with the LLM | MEDIUM | Return ranked chunks with **score, snippet, document ID/path, chunk index** — pattern in [mcp-rag-server](https://github.com/Daniel-Barta/mcp-rag-server), [ks-mcp](https://github.com/knowledgestack/ks-mcp), [marciocamello/mcp-rag](https://github.com/marciocamello/mcp-rag) |
| **MCP stdio transport** | Default for local IDE clients (Cursor, Claude Desktop, VS Code Continue) | LOW | Required by PROJECT.md; universal among competitors |
| **MCP SSE / Streamable HTTP transport** | Remote/hosted MCP access without local process coupling | MEDIUM | [mylo-james/mcp](https://github.com/mylo-james/mcp), [MODULAR-RAG-MCP-SERVER](https://github.com/nobitalqs/MODULAR-RAG-MCP-SERVER), [ks-mcp](https://github.com/knowledgestack/ks-mcp) all support dual transports |
| **Document ingestion pipeline** | Search is useless without indexed content; users expect upload → chunk → embed → store | HIGH | Competitors implement via MCP tools, CLI, or separate admin API; **this project separates ingestion from MCP** (admin-only) |
| **Vector persistence** | Restart must not wipe the knowledge base | LOW | Chroma persistent client is standard; [chroma-mcp](https://github.com/chroma-core/chroma-mcp) documents persistent vs ephemeral modes |
| **Core text formats (txt, md, PDF text-layer)** | Minimum viable document corpus for dev/personal KB | MEDIUM | PDF text extraction without OCR is common ([mcp-rag-server](https://github.com/Daniel-Barta/mcp-rag-server)); OCR is a separate tier |
| **Configurable chunking** (size + overlap) | Retrieval quality depends on chunk boundaries; users tune for code vs prose | MEDIUM | Defaults ~800–2400 chars with overlap appear across [mcp-rag-server](https://github.com/Daniel-Barta/mcp-rag-server), [RAG-MCP](https://github.com/Mikethebot44/RAG-MCP) |
| **Embedding generation on ingest** | Semantic search requires vectors at index time | MEDIUM | External API (OpenAI-compatible) or local model; this project uses CherryIn Qwen3 |
| **Source attribution in results** | LLMs and users need to cite or verify answers; bare text blobs are insufficient | LOW | Include `document_id`, `filename`, `chunk_index`, `score`, optional `page` for PDF |
| **Document list / corpus visibility** | Users must know what's indexed before trusting search | LOW | Admin surfaces (REST/Web/CLI) expected; some MCP servers also expose `list_sources` ([RAG-MCP](https://github.com/Mikethebot44/RAG-MCP)) |
| **Delete / re-index document** | Stale or wrong docs must be removable without rebuilding entire store | MEDIUM | Admin CRUD is table stakes for any KB admin; competitors expose via MCP or REST |
| **Environment-based configuration** | API keys and paths must not be hardcoded; `.env` is the norm | LOW | Universal pattern; MCP spec emphasizes input validation and access control |
| **Admin ingestion path (non-MCP)** | Upload is an admin workflow, not an agent action — increasingly preferred for safety | MEDIUM | [loglux/RAG-Knowledge-Base-Platform](https://github.com/loglux/RAG-Knowledge-Base-Platform) explicitly separates "retrieve-only API for MCP" from chat/upload UI |
| **"Test search" in admin** | Operators validate indexing before wiring MCP client | LOW | Common in RAG admin UIs ([RagMate](https://github.com/lg114/RagMate), [rag-web-ui](https://github.com/rag-web-ui/rag-web-ui)); aligns with PROJECT.md web admin requirement |
| **Clear MCP tool descriptions** | LLM tool selection depends on name + description quality; MCP spec requires schema metadata | LOW | Keep tool count small (1–3 search tools); MCP best practice favors minimal, well-described tools over large catalogs |

### Differentiators (Competitive Advantage)

Features that set a product apart. Not required for v1 viability, but create competitive edge when done well. **Bold items align with this project's explicit design choices.**

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **MCP retrieval-only; ingestion via backend/CLI/Web** | Keeps MCP tools fast, safe, and token-efficient; prevents agents from accidentally mutating corpus | MEDIUM | **Project differentiator.** Most OSS competitors mix ingest + search in MCP ([knowledge-rag](https://mcpservers.org/servers/lyonzin/knowledge-rag): 13 tools; [MODULAR-RAG-MCP-SERVER](https://github.com/nobitalqs/MODULAR-RAG-MCP-SERVER): 5 tools incl. ingest). Separation matches MCP security guidance (human-in-loop for writes) |
| **REST + Web + CLI admin trifecta** | Meets operators where they work: automation (REST/CLI), visual upload (Web), scripts (CLI) | HIGH | **Project differentiator.** Many MCP-only projects skip Web UI entirely; full-stack RAG platforms have Web but no MCP |
| **Optional API key auth (env-gated, off by default)** | Safe localhost dev; one-flag hardening for LAN/shared hosts | LOW | **Project differentiator.** Production MCP servers ([ks-mcp](https://github.com/knowledgestack/ks-mcp)) use tenant auth; personal scaffolds often skip auth — optional gate is the right middle ground |
| **Single default collection, multi-collection-ready APIs** | Ship fast without schema rewrites when adding namespaces later | MEDIUM | **Project differentiator.** Competitors either hardcode one collection ([marciocamello/mcp-rag](https://github.com/marciocamello/mcp-rag)) or go full multi-tenant day one ([mylo-james/mcp](https://github.com/mylo-james/mcp)) |
| **Hybrid search (BM25 + semantic + RRF)** | Better recall for exact terms, IDs, and code symbols that pure embedding search misses | HIGH | Present in [knowledge-rag](https://mcpservers.org/servers/lyonzin/knowledge-rag), [rag-mcp (Rust)](https://github.com/mr-nozko/rag-mcp), [MODULAR-RAG-MCP-SERVER](https://github.com/nobitalqs/MODULAR-RAG-MCP-SERVER) — strong differentiator but **defer for v1** |
| **Cross-encoder reranking** | Precision boost on top-K candidates; fewer irrelevant chunks in LLM context | HIGH | [knowledge-rag](https://mcpservers.org/servers/lyonzin/knowledge-rag), [RagMate](https://github.com/lg114/RagMate) — v1.x candidate |
| **Context expansion tools** (`read_around`, `read`) | Agent fetches neighboring chunks or full doc sections after initial search hit | MEDIUM | [ks-mcp](https://github.com/knowledgestack/ks-mcp) `read`, `read_around`; [mcp-rag-server](https://github.com/Daniel-Barta/mcp-rag-server) `read_file` — valuable v1.x MCP addition without opening ingest |
| **Structured citations tool** | One-call citation objects for grounded answers | MEDIUM | [ks-mcp](https://github.com/knowledgestack/ks-mcp) `cite` — optional if search results already include citation fields |
| **Markdown-aware / heading-aware chunking** | Preserves doc structure; better retrieval for technical docs | MEDIUM | [knowledge-rag](https://mcpservers.org/servers/lyonzin/knowledge-rag), [loglux/RAG-Knowledge-Base-Platform](https://github.com/loglux/RAG-Knowledge-Base-Platform) — v1.x improvement over fixed-window chunking |
| **Incremental / change-detection indexing** | Avoid re-embedding unchanged files on re-run | MEDIUM | [marciocamello/mcp-rag](https://github.com/marciocamello/mcp-rag), [mylo-james/mcp](https://github.com/mylo-james/mcp) `ingest.changed` — CLI/batch optimization |
| **MCP resources** (`corpus://info`, health) | Passive context for clients without tool invocation | LOW | [mylo-james/mcp](https://github.com/mylo-james/mcp) exposes `corpus://info`, `status://health` — nice polish, not launch-blocking |
| **Metadata filtering in search** | Narrow results by tag, doc type, date, collection | MEDIUM | [chroma-mcp](https://github.com/chroma-core/chroma-mcp) supports `where` metadata filters — unlock when multi-collection lands |
| **Grounded Q&A tool (`ask`)** | One-shot answer + citations without client-side RAG assembly | HIGH | [ks-mcp](https://github.com/knowledgestack/ks-mcp) flagship feature — **explicitly out of scope** for this project (search-only MCP) |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem attractive but create scope creep, security risk, or architectural conflict with this project's core value.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Document upload/CRUD via MCP tools** | "One interface for everything"; agents could self-index | Write operations via MCP expand attack surface; large uploads bloat tool latency; MCP spec warns about unsupervised tool invocation | **Backend REST + Web + CLI only** (PROJECT.md decision). MCP stays read/search |
| **Built-in LLM `ask` / chat tool** | ks-mcp-style one-shot Q&A feels magical | Couples retrieval to a specific LLM provider; duplicates what the MCP client already does with search results | Return rich search results; let client LLM synthesize |
| **OCR / scanned PDF support** | "Support all PDFs" | Heavy deps (Tesseract, vision models), unreliable text, slow ingest | Text-layer PDF only in v1; document limitation clearly in admin UI |
| **Multi-tenant / production RBAC** | Enterprise readiness | Orders of magnitude more auth, isolation, and ops complexity | Optional single API key gate; defer tenants to v2+ |
| **Hosted/managed vector DB** (Qdrant Cloud, pgvector cluster) | Scale narrative | Conflicts with local-first scaffold goal; adds infra deps | Local Chroma; abstract store interface for future swap |
| **13+ MCP tools** (full CRUD + search + config) | Feature parity with [knowledge-rag](https://mcpservers.org/servers/lyonzin/knowledge-rag) | Tool catalog bloat hurts LLM selection accuracy; MCP ecosystem pushes minimal tool sets | 1–3 search-focused tools; admin handles everything else |
| **Real-time file watcher / auto-sync** | "Always up to date" | Race conditions, partial indexes, surprise embedding costs | Explicit CLI/REST ingest + optional batch reindex command |
| **Multi-modal retrieval** (images, tables, vision LLM) | [MODULAR-RAG-MCP-SERVER](https://github.com/nobitalqs/MODULAR-RAG-MCP-SERVER) showcases it | Large complexity surface; not needed for txt/md/PDF-text v1 | Text-only pipeline; revisit if user corpus requires it |
| **Web scraping / GitHub repo indexing in v1** | [RAG-MCP](https://github.com/Mikethebot44/RAG-MCP) differentiator | External fetch, rate limits, legal/robots concerns, Playwright deps | Manual upload or CLI ingest of exported content |
| **Hybrid search + reranking in v1** | Best retrieval quality | Doubles index size (BM25), adds reranker model deps, harder to debug | Pure semantic search first; validate core loop, then add hybrid in v1.x |
| **Embedding model swappability in v1** | Future-proofing | Re-embedding entire corpus on model change is a migration project, not a toggle | Externalize config but treat model as fixed for v1; document re-index requirement |
| **Using Chroma MCP server as the product** | Official [chroma-mcp](https://github.com/chroma-core/chroma-mcp) exists | Generic CRUD tools, not opinionated KB workflow; no admin UI/CLI; wrong abstraction for "kb-mcp-server" product | Use Chroma as library/storage; build domain-specific MCP search tools + admin |

## Feature Dependencies

```
Document Parsing (txt/md/PDF-text)
    └──requires──> Chunking Engine
                       └──requires──> Embedding Client (CherryIn API)
                                          └──requires──> Chroma Storage
                                                             └──requires──> Semantic Search MCP Tool

Backend REST API
    └──requires──> Ingestion Pipeline (same as above)
    └──requires──> Document CRUD + List endpoints

Web Admin UI
    └──requires──> Backend REST API

CLI Ingest
    └──requires──> Backend REST API (or shared ingest library)

Optional API Key Auth
    └──requires──> Backend REST API middleware
    └──enhances──> Web Admin + CLI (shared auth header)

Test Search (Web)
    └──requires──> Semantic Search (shared query path with MCP)

MCP SSE Transport
    └──requires──> Semantic Search MCP Tool (same handlers as stdio)

Multi-Collection Support (future)
    └──requires──> Collection-scoped APIs + metadata filters
    └──conflicts──> Single-collection shortcuts in v1 (mitigate via collection param with default)

Hybrid Search (future)
    └──requires──> BM25 index or Chroma full-text
    └──enhances──> Semantic Search MCP Tool

read_around / read_file MCP tools (future)
    └──requires──> Chunk metadata (doc_id, chunk_index, offsets)
    └──enhances──> Semantic Search MCP Tool
```

### Dependency Notes

- **Semantic search requires full ingest pipeline:** No shortcuts — empty Chroma means empty search; admin and MCP must share one query/index path.
- **Web admin requires REST first:** Web is a client of REST; build API contracts before UI to keep CLI/Web/MCP consistent.
- **MCP retrieval-only enhances security:** Ingestion dependencies stay on authenticated admin path; MCP server needs only read access to Chroma + embed query vectors.
- **Optional API key conflicts with zero-config local dev:** Must default off (`AUTH_ENABLED=false`) with clear env docs — matches PROJECT.md constraint.
- **Multi-collection-ready API shape conflicts with v1 simplicity:** Use optional `collection` param defaulting to `"default"` so v1 code paths stay simple.

## MVP Definition

### Launch With (v1)

Minimum viable product — validates core value: *"MCP client can reliably semantic-search ingested documents."*

- [ ] **`search_knowledge` MCP tool** — ranked chunks with source metadata; primary success metric
- [ ] **MCP stdio + SSE entrypoints** — local IDE + remote client support
- [ ] **Ingestion pipeline** — txt, md, text-layer PDF → chunk → embed → Chroma
- [ ] **Chroma persistent storage** — single default collection
- [ ] **Backend REST API** — upload, list documents, delete, search (retrieve-only)
- [ ] **Web admin** — upload, document list, test search
- [ ] **CLI** — ingest file/dir, list docs (calls REST or shared lib)
- [ ] **Env-based config** — CherryIn API key, Chroma path, optional auth flag
- [ ] **Optional API key auth** — disabled by default for localhost dev

### Add After Validation (v1.x)

Features to add once core search loop is proven in daily Cursor use.

- [ ] **`read_file` / `read_around` MCP tools** — context expansion without ingest exposure
- [ ] **Markdown-aware chunking** — when fixed-window retrieval quality is insufficient
- [ ] **Incremental re-index** — skip unchanged files (hash/mtime)
- [ ] **Hybrid BM25 + semantic search** — when exact-term recall fails in practice
- [ ] **Cross-encoder reranking** — when top-K noise is observed in MCP client sessions
- [ ] **MCP resources** — corpus stats, health status
- [ ] **Multi-collection support** — when user has distinct doc namespaces (work vs personal)

### Future Consideration (v2+)

Defer until product-market fit and repeated user demand.

- [ ] **Multi-tenant auth / RBAC** — only if sharing beyond personal machine
- [ ] **Additional formats** — DOCX, HTML, code-aware indexing
- [ ] **Embedding model migration tooling** — re-index wizard when swapping models
- [ ] **Remote Chroma / pgvector backend** — if local disk becomes limiting
- [ ] **Grounded `ask` tool** — only if users reject client-side synthesis pattern
- [ ] **Observability dashboard** — query logs, ingest metrics, Ragas-style eval ([MODULAR-RAG-MCP-SERVER](https://github.com/nobitalqs/MODULAR-RAG-MCP-SERVER))

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Semantic search MCP tool | HIGH | MEDIUM | P1 |
| Ingestion pipeline (txt/md/PDF) | HIGH | HIGH | P1 |
| Chroma persistence | HIGH | LOW | P1 |
| REST API (upload/list/delete/search) | HIGH | MEDIUM | P1 |
| Web admin (upload/list/test search) | HIGH | MEDIUM | P1 |
| CLI ingest | MEDIUM | LOW | P1 |
| MCP stdio + SSE | HIGH | MEDIUM | P1 |
| Env config + secrets hygiene | HIGH | LOW | P1 |
| Optional API key auth | MEDIUM | LOW | P1 |
| Source attribution in results | HIGH | LOW | P1 |
| Document delete/re-index | HIGH | MEDIUM | P1 |
| `read_around` MCP tool | MEDIUM | MEDIUM | P2 |
| Markdown-aware chunking | MEDIUM | MEDIUM | P2 |
| Incremental indexing | MEDIUM | MEDIUM | P2 |
| Hybrid search | HIGH | HIGH | P2 |
| MCP health/corpus resources | LOW | LOW | P2 |
| Multi-collection | MEDIUM | MEDIUM | P3 |
| Reranking | MEDIUM | HIGH | P3 |
| Grounded ask tool | LOW (for this project) | HIGH | P3 — defer |
| OCR / multi-modal | LOW (v1) | HIGH | P3 — out of scope |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | ks-mcp (production) | knowledge-rag (local OSS) | mcp-rag-server (lightweight) | chroma-mcp (generic) | **kb-mcp-server (planned)** |
|---------|---------------------|---------------------------|-------------------------------|----------------------|----------------------------|
| Primary MCP surface | 12+ tools incl. ask, cite, read | 13 tools, full CRUD + search | 3 tools: search, read, list | Generic Chroma CRUD/query | **1–2 search tools only** |
| Ingestion | External KS platform | MCP + file watcher | Pre-index / env-triggered | MCP `add_documents` | **REST + Web + CLI only** |
| Transports | stdio + Streamable HTTP | stdio | stdio (+ HTTP beta) | stdio | **stdio + SSE** |
| Vector store | Managed KS backend | ChromaDB local | Local JSON + embeddings | Chroma (any mode) | **Local Chroma** |
| Hybrid search | Semantic + BM25 | Semantic + BM25 + rerank | Semantic only | Semantic + full-text | **Semantic v1; hybrid v1.x** |
| Admin UI | KS web app (external) | CLI/config only | None | None | **Lightweight Web admin** |
| Auth | Tenant-scoped SaaS | None (local) | None | API keys for embed providers | **Optional API key (env)** |
| Q&A tool | `ask` (grounded) | Via search + client | No | No | **No — search only** |
| Citations | Structured `cite` tool | Inline in results | Path + score in snippets | Metadata-dependent | **In search result payload** |
| Collections | Multi-tenant | Multi-collection | Single repo root | Multi-collection native | **Single default; API-ready** |

## Sources

- [MCP Tools Specification](https://modelcontextprotocol.io/specification/2025-03-26/server/tools) — tool schema, transports, security (HIGH)
- [MCP Server Concepts](https://modelcontextprotocol.io/docs/learn/server-concepts) — tools vs resources (HIGH)
- [knowledgestack/ks-mcp](https://github.com/knowledgestack/ks-mcp) — production KB MCP feature set (HIGH)
- [lyonzin/knowledge-rag](https://mcpservers.org/servers/lyonzin/knowledge-rag) — local hybrid RAG MCP (HIGH)
- [Daniel-Barta/mcp-rag-server](https://github.com/Daniel-Barta/mcp-rag-server) — lightweight search + read pattern (HIGH)
- [nobitalqs/MODULAR-RAG-MCP-SERVER](https://github.com/nobitalqs/MODULAR-RAG-MCP-SERVER) — dual transport, hybrid, observability (HIGH)
- [marciocamello/mcp-rag](https://github.com/marciocamello/mcp-rag) — Chroma + incremental index (HIGH)
- [mylo-james/mcp](https://github.com/mylo-james/mcp) — pgvector MCP, resources, multi-DB (HIGH)
- [Mikethebot44/RAG-MCP](https://github.com/Mikethebot44/RAG-MCP) — ingest-via-MCP anti-pattern reference (HIGH)
- [chroma-core/chroma-mcp](https://github.com/chroma-core/chroma-mcp) — generic Chroma MCP tools (HIGH)
- [Chroma MCP integration docs](https://docs.trychroma.com/integrations/frameworks/anthropic-mcp) — client types, search capabilities (HIGH)
- [loglux/RAG-Knowledge-Base-Platform](https://github.com/loglux/RAG-Knowledge-Base-Platform) — retrieve-only API + admin UI pattern (MEDIUM)
- [lg114/RagMate](https://github.com/lg114/RagMate) — self-hosted admin UI norms (MEDIUM)
- [rag-web-ui/rag-web-ui](https://github.com/rag-web-ui/rag-web-ui) — async ingest + admin patterns (MEDIUM)
- PROJECT.md — explicit scope, out-of-scope, and design decisions for kb-mcp-server (HIGH)

---
*Feature research for: knowledge-base MCP server (kb-mcp-server)*
*Researched: 2026-06-29*
