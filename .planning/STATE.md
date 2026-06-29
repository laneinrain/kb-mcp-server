# Project State: kb-mcp-server

## Project Reference

**Core value:** An MCP client can reliably semantic-search ingested documents through a stable tool interface.

**Stack:** TypeScript/Node monorepo (pnpm + Turborepo), Chroma HTTP sidecar, CherryIn embeddings (`qwen/qwen3-embedding-8b`), Fastify backend, Vite web admin, Commander CLI.

**Architecture:** Dual-pipeline RAG — ingestion via admin surfaces → core services → Chroma; retrieval via MCP/REST → SearchService → Chroma. MCP is retrieval-only.

## Current Position

| Field | Value |
|-------|-------|
| **Phase** | 1 — Platform Foundation & Ingestion |
| **Plan** | Not started |
| **Status** | Roadmap created — ready for `/gsd-plan-phase 1` |
| **Progress** | ░░░░░░░░░░ 0/4 phases |

## Performance Metrics

| Metric | Value |
|--------|-------|
| v1 requirements | 30 |
| Requirements mapped | 30/30 |
| Phases complete | 0/4 |
| Plans complete | 0 |

## Accumulated Context

### Decisions

| Decision | Source | Status |
|----------|--------|--------|
| MCP retrieval-only; ingestion via backend | PROJECT.md | Pending implementation |
| Chroma local sidecar (HTTP server mode) | PROJECT.md / research | Pending implementation |
| Single default collection, multi-collection-ready APIs | PROJECT.md | Pending implementation |
| TypeScript/Node monorepo | PROJECT.md | Pending implementation |
| Text-layer PDF only (no OCR) | PROJECT.md | Pending implementation |
| Optional API key auth via env (off by default) | PROJECT.md | Pending implementation |
| Build order: foundation → ingest → REST → MCP stdio/SSE → admin → auth | ROADMAP.md / research | Active |

### Todos

- [ ] Plan Phase 1: Platform Foundation & Ingestion
- [ ] Validate CherryIn embedding API during Phase 1 planning (batch limits, rate limits)

### Blockers

(None)

## Session Continuity

**Last updated:** 2026-06-29  
**Last action:** Roadmap created with 4 coarse phases covering 30 v1 requirements  
**Next step:** `/gsd-plan-phase 1`

---
*State initialized: 2026-06-29*
