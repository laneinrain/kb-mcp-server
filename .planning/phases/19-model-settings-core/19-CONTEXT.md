# Phase 19: Model Settings Core - Context

**Gathered:** 2026-07-20  
**Status:** Ready for execution

<domain>
## Phase Boundary

Persist **embedding / rerank** runtime settings in SQLite `settings`, expose them on the settings REST API, and make search/ingest clients **read those values per request** (not only boot-time env).

**In scope:** CONF-04, CONF-05, CONF-06

**Out of scope (Phase 20+):** Web Settings form UI; embedding risk banners; Help/User Guide; changing `EMBEDDING_DIMENSIONS` online

**Unchanged this phase:** Context/chunk settings behavior; MCP auth; Chroma schema; env vars remain seed defaults + dimensions source of truth
</domain>

<decisions>
## Implementation Decisions

### ModelConfig shape (CONF-04)
- **D-01:** New type in `packages/core/src/registry/types.ts`:

  ```typescript
  export interface ModelConfig {
    embeddingModel: string;
    rerankEnabled: boolean;
    rerankModel: string;
    rerankCandidates: number; // 1–50
  }
  ```

- **D-02:** SQLite columns on `settings` (migrate via `migrateSettingsColumns`):
  - `embedding_model TEXT NOT NULL` (default from env at seed/migration)
  - `rerank_enabled INTEGER NOT NULL` (0/1)
  - `rerank_model TEXT NOT NULL`
  - `rerank_candidates INTEGER NOT NULL`
- **D-03:** `seedSettingsIfMissing` includes model fields from `AppConfig` (`EMBEDDING_MODEL`, `RERANK_ENABLED`, `RERANK_MODEL`, `RERANK_CANDIDATES`)
- **D-04:** For existing DBs: `ALTER TABLE` add columns with defaults matching current env when migration runs (same pattern as context columns)
- **D-05:** `SettingsStore` gains `getModelConfig()` / `updateModelConfig(patch: Partial<ModelConfig>): ModelConfig`
- **D-06:** `updateModelConfig` validates `rerankCandidates` in 1–50; `embeddingModel` / `rerankModel` non-empty trimmed strings

### REST (CONF-05)
- **D-07:** Extend `GET /api/v1/settings` response with `models: ModelConfig` (+ read-only `embeddingDimensions` from `config.EMBEDDING_DIMENSIONS` for Phase 20 UI — include now to avoid API churn)
- **D-08:** `PATCH /api/v1/settings/models` body = ModelConfig (full replace of the four fields, same style as context PATCH)
- **D-09:** Zod: `rerankCandidates` int 1–50; model strings `min(1)`; `rerankEnabled` boolean
- **D-10:** Response of PATCH: `{ models: ModelConfig }` (and optionally echo `embeddingDimensions` read-only)

### Runtime wiring (CONF-06)
- **D-11:** `EmbeddingClient` stops hardcoding `const EMBEDDING_MODEL`; use `config.EMBEDDING_MODEL` as **fallback**, and prefer optional `getEmbeddingModel?: () => string` (or inject settingsStore) so each embed call uses current settings
- **D-12:** Prefer **callback / settingsStore** over freezing model on `SearchService.create`:
  - `SearchService.create(config, { …, settingsStore })` reads `getModelConfig()` inside `search()` for `rerankEnabled` / `candidates` / `model`
  - If `settingsStore` omitted (tests), fall back to env from `config` (today’s behavior)
- **D-13:** `RerankClient.rerank` already accepts `options.model` — SearchService passes settings model
- **D-14:** Backend `createAppServices` + MCP `createMcpServices` pass `settingsStore` into `SearchService.create` and configure EmbeddingClient with model getter from settings
- **D-15:** Health `GET /health/embeddings` returns `model` from `settingsStore.getModelConfig().embeddingModel` (not `@kb/config` constant)

### Claude's Discretion
- Exact callback vs settingsStore injection API on EmbeddingClient
- Whether chroma metadata `embedding_model` updates on ingest (can keep using current model string from settings at write time)
</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — CONF-04–06
- `.planning/milestones/v1.6-ROADMAP.md` — Phase 19
- `packages/core/src/registry/settings-store.ts` — context settings pattern
- `packages/core/src/registry/schema.sql` — settings table
- `apps/backend/src/routes/settings.ts` — REST pattern
- `packages/core/src/search/search-service.ts` — rerank freeze at create
- `packages/core/src/embeddings/embedding-client.ts` — hardcoded model
- `apps/backend/src/services.ts` / `apps/mcp-server/src/services.ts`
</canonical_refs>

<code_context>
## Existing Code Insights

### Ready
- Context settings: migrate columns + seed + get/update + PATCH route
- `SearchService.create` already takes `AppConfig` for rerank flags
- RerankClient accepts per-call `model` override

### Gaps
- EmbeddingClient ignores `config.EMBEDDING_MODEL` (hardcoded constant)
- SearchService freezes rerank options at construction — PATCH would not affect in-process searches
- MCP and Backend each create SearchService independently — both need settingsStore wiring
</code_context>

<specifics>
## Locked Specifics

- Do **not** persist or PATCH `embeddingDimensions` in v1.6
- Do **not** rebuild Chroma collections when embedding model changes
- Env vars remain the seed source; after first seed, SQLite wins until PATCH
</specifics>
