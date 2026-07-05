# Milestones: kb-mcp-server

## v1.0 Initial Release

**Shipped:** 2026-07-05  
**Timeline:** 2026-06-29 → 2026-07-05 (7 days)  
**Phases:** 4 | **Plans:** 13

### Delivered

A self-hosted knowledge-base scaffold: ingest txt/markdown/text-layer PDF into local Chroma via CherryIn embeddings; semantic search through MCP (stdio + Streamable HTTP), REST API, web admin, and CLI — with optional bearer auth and production static serve.

### Key Accomplishments

1. **Ingestion pipeline** — Monorepo (pnpm + Turborepo), Zod config, Chroma sidecar, parsers, IngestionService with delete-then-upsert, CherryIn `qwen/qwen3-embedding-8b` embeddings
2. **REST backend** — Fastify API for document upload/list/delete and test search via shared SearchService; Swagger docs; health endpoints
3. **MCP retrieval** — `search_knowledge` tool over stdio and Streamable HTTP; retrieval-only, bounded responses, stderr-only stdio logging
4. **Admin surfaces** — Vite/React web admin (简体中文), Commander CLI, optional bearer auth on `/api/v1`, static SPA serve from backend
5. **UAT hardening** — Monorepo-root path resolution for SQLite/data, CLI `INIT_CWD` restore, original filename on upload, ID copy column in web UI

### Stats

| Metric | Value |
|--------|-------|
| v1 requirements | 30/30 |
| Phase 3 UAT | 8/8 passed |
| Phase 4 UAT | 7/8 passed (1 skipped: auth) |
| Git range | init → feat(04-04) |

### Archives

- [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)

### Known Gaps

- CONF-03 bearer auth not manually UAT-tested (implementation + unit tests complete)

---
*Milestone completed via `/gsd-complete-milestone`*

## v1.1 MCP Context Tools

**Started:** 2026-07-05  
**Status:** Planning complete — Phases 5–6  
**Goal:** `read_around` + `read_file` MCP tools for context expansion after `search_knowledge`

**Scope (Option B):** Context tools only — no hybrid search or rerank in this milestone.

---
*Milestone started via `/gsd-new-milestone`*
