# Requirements: kb-mcp-server

**Defined:** 2026-07-16  
**Milestone:** v1.4 Qwen Rerank Search  
**Core Value:** An MCP client can reliably semantic-search ingested documents through a stable tool interface.

## Milestone Goal

Add **two-stage retrieval** to search: Chroma vector recall followed by **Qwen3 reranking** via CherryIn (`qwen/qwen3-reranker-0.6b`, free tier). Improve precision of `search_knowledge` and `POST /api/v1/search` without changing ingestion, MCP tool surface, or embedding model.

## v1.4 Requirements

### Rerank Client (CherryIn)

- [ ] **RETR-02**: `RerankClient` calls CherryIn rerank API at `{CHERRYIN_BASE_URL}/rerank` with model `qwen/qwen3-reranker-0.6b`
- [ ] **RETR-03**: Reuses existing `CHERRYIN_API_KEY` and `CHERRYIN_BASE_URL` (same provider as embeddings)
- [ ] **RETR-04**: Request shape: `query` + `documents[]` + optional `top_n`; response maps `index` + `relevance_score` per Cohere/Jina rerank convention
- [ ] **RETR-05**: Rate-limit retry (429) with same backoff pattern as `EmbeddingClient`

### Search Pipeline Integration

- [ ] **RETR-06**: When `RERANK_ENABLED=true`, `SearchService` recalls `RERANK_CANDIDATES` (default 30) from Chroma, then reranks to final `topK`
- [ ] **RETR-07**: Returned `score` reflects rerank `relevance_score` (not vector cosine) when rerank applied
- [ ] **RETR-08**: ACL `allowedDocumentIds` filter applied **after** vector recall, **before** rerank (same REST user isolation semantics)
- [ ] **RETR-09**: When `RERANK_ENABLED=false` or rerank API fails, fall back to vector-only ranking (no search failure)
- [ ] **RETR-10**: Rerank uses **full chunk text** from Chroma (not 500-char display snippet)

### Configuration & Surfaces

- [ ] **RETR-11**: Env config: `RERANK_ENABLED` (default `true`), `RERANK_MODEL`, `RERANK_CANDIDATES` (default 30, max 50)
- [ ] **RETR-12**: REST `POST /api/v1/search` and MCP `search_knowledge` both use reranked `SearchService` (no separate code paths)
- [ ] **RETR-13**: README + `.env.example` document rerank settings and two-stage retrieval behavior

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RETR-02 | 13 | Pending |
| RETR-03 | 13 | Pending |
| RETR-04 | 13 | Pending |
| RETR-05 | 13 | Pending |
| RETR-06 | 14 | Pending |
| RETR-07 | 14 | Pending |
| RETR-08 | 14 | Pending |
| RETR-09 | 14 | Pending |
| RETR-10 | 14 | Pending |
| RETR-11 | 15 | Pending |
| RETR-12 | 15 | Pending |
| RETR-13 | 15 | Pending |

**Coverage:** 0/12

## Out of Scope (v1.4)

- Hybrid BM25 + semantic fusion (RETR-01)
- Web 设置 tab for runtime rerank toggle (env-only v1.4; settings API deferred)
- Per-user MCP document scoping (PLAT-04)
- Changing embedding model or chunking strategy
- Rerank on `read_around` / `read_file` (search-only)
- Local/self-hosted reranker deployment

## Key Decisions (locked for planning)

| Decision | Rationale |
|----------|-----------|
| Model `qwen/qwen3-reranker-0.6b` | User-specified; free tier on CherryIn |
| CherryIn same credentials | No new API keys; consistent with embedding client |
| Two-stage recall → rerank | Standard RAG pattern; Chroma has no built-in rerank |
| Default `RERANK_CANDIDATES=30` | Balance precision vs API cost/latency |
| Fallback to vector order on rerank failure | Search must not break if rerank API down |
| ACL before rerank | Don't score chunks user cannot access |
| Score = rerank relevance when enabled | Clear semantics for downstream agents |

## Retrieval Flow (target)

```
query
  → embedQuery (qwen3-embedding-8b)
  → Chroma.query(n=RERANK_CANDIDATES)
  → ACL filter (REST JWT path)
  → RerankClient.rerank(query, full chunk texts, top_n=topK)
  → truncate snippets for response (500 chars)
```

---

*Created via `/gsd-new-milestone` 2026-07-16*
