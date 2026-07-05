# 09-02 Summary

**Status:** Complete  
**Plan:** IngestionService created / unchanged / replaced outcomes

## Delivered

- `IngestOutcome` type and `outcome` on `IngestResult`
- Dedup flow: parse → hash → lookup by `(userId, filename)`
- `unchanged`: skip embed/Chroma upsert, return existing doc
- `replaced`: delete old vectors from prior collection, re-index same id
- `created`: stable id via `deriveDocumentIdForUserFile(userId, filename)`
- Ingestion tests rewritten for dedup semantics

## Verification

- `pnpm --filter @kb/core test` — 70/70 pass
