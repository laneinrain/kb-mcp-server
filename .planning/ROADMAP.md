# Roadmap: kb-mcp-server

**Core Value:** An MCP client can reliably semantic-search ingested documents through a stable tool interface.

## Milestones

- ✅ **v1.0 Initial Release** — Phases 1–4 (shipped 2026-07-05)
- 🚧 **v1.1 MCP Context Tools** — Phases 5–6 (in progress)

See [MILESTONES.md](MILESTONES.md) and [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for v1.0 details.

## Phases

<details>
<summary>✅ v1.0 Initial Release (Phases 1–4) — SHIPPED 2026-07-05</summary>

- [x] Phase 1: Platform Foundation & Ingestion (3/3 plans)
- [x] Phase 2: REST Backend & Search (3/3 plans)
- [x] Phase 3: MCP Search Server (3/3 plans)
- [x] Phase 4: Admin Surfaces & Security (4/4 plans)

</details>

### 🚧 v1.1 MCP Context Tools (In Progress)

- [ ] **Phase 5: Context Retrieval Core** — ContextService reads neighboring and full-document chunks from Chroma with bounds and errors
- [ ] **Phase 6: MCP Read Tools** — `read_around` and `read_file` on stdio + HTTP; UAT with search → expand workflow

## Phase Details

### Phase 5: Context Retrieval Core

**Goal:** Core services can fetch chunk text by document ID and index range using the same store as semantic search.

**Depends on:** v1.0 complete (SearchService, ChromaVectorStore, DocumentRegistry)

**Requirements:** CORE-01, CORE-02

**Success Criteria** (what must be TRUE):

1. Service can load all chunks for a document ID in chunk_index order from Chroma
2. Service can load a window of chunks around a given chunk_index (e.g. ±N neighbors)
3. Responses enforce max chunks and max characters with truncation metadata
4. Unknown document ID or invalid chunk index returns structured error without leaking partial content
5. Unit tests cover happy path, bounds, and error cases with mocked Chroma

**Plans:** 0/2 plans complete

Plans:

- [ ] 05-01-PLAN.md — ContextService, Chroma fetch-by-document, chunk ordering
- [ ] 05-02-PLAN.md — read_around / read_file logic, bounds, unit tests (CORE-01, CORE-02)

---

### Phase 6: MCP Read Tools

**Goal:** MCP clients can expand search hits via `read_around` and `read_file` on both transports.

**Depends on:** Phase 5

**Requirements:** MCP-07, MCP-08, MCP-09, MCP-10, MCP-11

**Success Criteria** (what must be TRUE):

1. MCP client can call `read_around` after `search_knowledge` and receive neighboring chunk texts with filenames and indices
2. MCP client can call `read_file` for a document ID and receive bounded full-document content
3. Tool schemas match on stdio and Streamable HTTP; no upload/delete/index tools added
4. Large documents are truncated with clear indication in response
5. Phase UAT: search → read_around workflow passes on live stack

**Plans:** 0/2 plans complete

Plans:

- [ ] 06-01-PLAN.md — Register read_around + read_file on buildMcpServer, Zod schemas, unit tests
- [ ] 06-02-PLAN.md — stdio/HTTP parity, MCP tool list verification, UAT checkpoint

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1–4 | v1.0 | 13/13 | Complete | 2026-07-05 |
| 5. Context Retrieval Core | v1.1 | 0/2 | Not started | — |
| 6. MCP Read Tools | v1.1 | 0/2 | Not started | — |

## Coverage

| Category | Requirements | Phase |
|----------|--------------|-------|
| Core Services | CORE-01, CORE-02 | 5 |
| MCP Context | MCP-07 – MCP-11 | 6 |

**Mapped:** 7/7 v1.1 requirements ✓

---
*Last updated: 2026-07-05 — milestone v1.1 started*
