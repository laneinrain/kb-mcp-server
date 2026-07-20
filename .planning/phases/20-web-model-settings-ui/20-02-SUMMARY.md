# Plan 20-02 Summary: Embedding Risk Warning

**Completed:** 2026-07-20  
**Requirement:** CONF-08  
**Status:** ✅ Done

## Delivered

- Read-only `embeddingDimensions` + `EMBEDDING_DIMENSIONS` note (from 20-01, retained)
- `savedEmbeddingModel` baseline; warning when form embedding model differs
- Warning copy: 重新上传/入库 + 不自动重建 Chroma
- Baseline resets on successful model save
- `.banner-warning` amber style

## Verification

```
pnpm --filter @kb/web build  # ok
```

## Phase 20 complete

CONF-07, CONF-08 shipped. Next: **Phase 21** MCP User Guide.
