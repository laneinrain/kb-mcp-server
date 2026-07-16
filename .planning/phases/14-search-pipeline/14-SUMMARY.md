# Phase 14 Summary

**Completed:** 2026-07-16  
**Phase:** Search Pipeline

## Delivered

- `SearchService` two-stage retrieval: Chroma recall (`RERANK_CANDIDATES`) → ACL filter → rerank → topK
- Rerank uses full chunk text; response `score` = rerank `relevanceScore`
- Graceful fallback to vector order on rerank failure
- `RERANK_ENABLED` (default `true`) and `RERANK_CANDIDATES` (default 30, max 50) in `@kb/config`
- `SearchService.create()` wires `RerankClient` — REST + MCP get rerank via existing factories
- 5 new SearchService tests (recall count, ACL, rerank scores, full text, fallback)

## Requirements

- RETR-06, RETR-07, RETR-08, RETR-09, RETR-10, RETR-11, RETR-12
