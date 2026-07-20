# Plan 19-01 Summary: ModelConfig SettingsStore

**Completed:** 2026-07-20  
**Requirement:** CONF-04  
**Status:** ✅ Done

## Delivered

- `ModelConfig` type: `embeddingModel`, `rerankEnabled`, `rerankModel`, `rerankCandidates`
- `schema.sql` + `migrateSettingsColumns(db, config)` add model columns (TEXT/INTEGER) with env defaults
- `seedSettingsIfMissing` inserts model fields from `AppConfig`
- `getModelConfig` / `updateModelConfig` with trim + candidates 1–50 validation
- Exported `ModelConfig` + `getModelConfig` from `@kb/core`
- Unit tests: seed, update/persist reopen, validation errors, legacy migrate (chunk-only + context-without-models)

## Verification

```
pnpm exec vitest run src/registry/settings-store.test.ts  # 12 passed
pnpm exec tsc -p tsconfig.json                            # ok
```

## Notes

- Full `pnpm --filter @kb/core test` may fail live CherryIn integration tests when `.env` has `CHERRYIN_API_KEY` pointing at downed mock `:8765` — unrelated to this plan.

## Next

Execute **19-02** — REST `GET`/`PATCH` settings models.
