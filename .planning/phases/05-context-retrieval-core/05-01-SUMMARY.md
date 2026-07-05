# Phase 5 Plan 01: Chroma getByIds & Context Settings Summary

**One-liner:** Batch Chroma fetch-by-ID with Map-by-id ordering, plus SQLite context settings with v1.0 migration and env-seeded defaults.

## Delivered

### ChromaVectorStore.getByIds
- Added `GetByIdsParams`, `ChunkHit`, and `getByIds()` using `collection.get({ ids, include })`
- Empty `ids` returns `[]` without calling Chroma
- Results built via Map-by-id, sorted by `chunk_index` ascending (not raw Chroma order)
- Exported from `@kb/core`

### Context settings store
- Extended `schema.sql` with five context columns
- Added `ContextConfig` type and `migrateSettingsColumns()` for v1.0 DB upgrades
- `getContextConfig()` / `updateContextConfig()` on `SettingsStore` with window max validation
- Module-level `getContextConfig()` singleton accessor
- Env defaults in `@kb/config`: `READ_AROUND_*`, `READ_FILE_*`
- Documented in `.env.example`

## Tests
- `chroma-store.test.ts`: 4 new getByIds tests
- `settings-store.test.ts`: context seed, get, update, v1.0 migration
- `env.test.ts`: new env var defaults

## Deviations
None — plan executed as written.
