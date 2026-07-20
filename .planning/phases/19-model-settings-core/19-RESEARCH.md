# Phase 19: Model Settings Core - Research

**Researched:** 2026-07-20

## Current model sources

| Consumer | Today | Target |
|----------|-------|--------|
| `EmbeddingClient` | Hardcoded `EMBEDDING_MODEL` from local const | Runtime settings → fallback `config.EMBEDDING_MODEL` |
| `SearchService.create` | Freezes `RERANK_*` from config | Read `settingsStore.getModelConfig()` per `search()` |
| `RerankClient` | Default `RERANK_MODEL` constant; override via options | Pass settings model from SearchService |
| `ChromaVectorStore` metadata | `@kb/config` `EMBEDDING_MODEL` constant | Prefer settings model string at upsert time if easy; else leave for Phase 20 |
| Health embeddings | Constant `EMBEDDING_MODEL` | Settings `embeddingModel` |

## Settings migration pattern (copy from context)

`migrateSettingsColumns` already loops `[col, defaultVal]` and `ALTER TABLE`. Extend with:

```typescript
// text defaults applied via DEFAULT in ALTER — SQLite allows TEXT DEFAULT '...'
["embedding_model", null], // special-case: use config.EMBEDDING_MODEL
```

For TEXT columns, either:
1. Add column nullable → backfill UPDATE → optional NOT NULL (SQLite limited), or
2. `ALTER TABLE … ADD COLUMN embedding_model TEXT NOT NULL DEFAULT 'qwen/…'` using values from `config` at migration time

**Recommendation:** Build ALTER statements with escaped defaults from `AppConfig` passed into `migrateSettingsColumns(db, config)` (signature change).

## SearchService wiring sketch

```typescript
static create(config, deps: {
  vectorStore, embeddingClient, rerankClient?, settingsStore?: SettingsStore
}): SearchService {
  return new SearchService(vectorStore, embeddingClient, config.DEFAULT_COLLECTION, {
    config,
    rerankClient: deps.rerankClient ?? new RerankClient(config),
    settingsStore: deps.settingsStore,
  });
}

// in search():
const models = this.settingsStore?.getModelConfig() ?? {
  embeddingModel: config.EMBEDDING_MODEL,
  rerankEnabled: config.RERANK_ENABLED,
  rerankModel: config.RERANK_MODEL,
  rerankCandidates: config.RERANK_CANDIDATES,
};
```

## EmbeddingClient sketch

```typescript
constructor(
  config: AppConfig,
  client?: OpenAI,
  private readonly getEmbeddingModel: () => string = () => config.EMBEDDING_MODEL,
) {}

// embeddings.create({ model: this.getEmbeddingModel(), ... })
```

Backend/MCP:

```typescript
new EmbeddingClient(config, undefined, () =>
  settingsStore.getModelConfig().embeddingModel,
);
```

## API response shape (forward-compatible with Phase 20)

```json
{
  "chunk": { "chunkSize": 1024, "chunkOverlap": 154 },
  "context": { ... },
  "models": {
    "embeddingModel": "qwen/qwen3-embedding-8b",
    "rerankEnabled": true,
    "rerankModel": "qwen/qwen3-reranker-0.6b",
    "rerankCandidates": 30
  },
  "embeddingDimensions": 1024
}
```

`embeddingDimensions` at top level (or under `models` as read-only) — pick **sibling field** on GET to keep `models` PATCH body clean.

## Tests

| Area | Cases |
|------|--------|
| settings-store | seed from env; update; candidates clamp/reject; migrate adds columns |
| settings routes | GET includes models; PATCH updates; 400 on candidates=0/51 |
| SearchService | with mock settingsStore, toggling rerankEnabled changes recallK / calls rerank |
| EmbeddingClient | mock OpenAI asserts `model` from getter |

## Risks

| Risk | Mitigation |
|------|------------|
| Existing process keeps old SearchService freeze | Per-request read (D-12) |
| MCP process separate from Backend | Both wire settingsStore; each has own SQLite read (same file) — OK for single-machine |
| Hardcoded embedding model tests | Update tests to pass config.EMBEDDING_MODEL / getter |
