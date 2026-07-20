# Phase 20: Web Model Settings UI - Context

**Gathered:** 2026-07-20  
**Status:** Ready for execution

<domain>
## Phase Boundary

Add an **Embedding / Rerank** section to the Web「设置」page so operators can edit runtime model settings via the Phase 19 REST API, with clear warnings when changing the embedding model and a read-only dimensions display.

**In scope:** CONF-07, CONF-08

**Out of scope:** Help/User Guide (Phase 21); changing `EMBEDDING_DIMENSIONS`; auto re-ingest; new navigation tabs

**Unchanged:** Context settings form behavior; chunk read-only section
</domain>

<decisions>
## Implementation Decisions

### API client (CONF-07)
- **D-01:** Extend `apps/web/src/api/settings.ts`:
  - `ModelSettings` type matching REST `models`
  - `SettingsResponse` adds `models` + `embeddingDimensions`
  - `updateModelSettings(body: ModelSettings)` → `PATCH /api/v1/settings/models`

### Settings UI layout (CONF-07)
- **D-02:** New section **「Embedding / Rerank」** on `SettingsPanel`, placed **above**「上下文检索」(models affect search more centrally than context knobs)
- **D-03:** Fields:
  - `embeddingModel` — text input
  - `rerankEnabled` — checkbox
  - `rerankModel` — text input (disabled when rerank off, still submitted with last value)
  - `rerankCandidates` — number 1–50
- **D-04:** Separate save button「保存模型设置」with its own mutation (do not couple to context form submit)
- **D-05:** Client-side validate: non-empty trimmed model strings; candidates integer 1–50 before PATCH
- **D-06:** On success: invalidate `["settings"]`; toast「已保存模型设置」

### Embedding risk + dimensions (CONF-08)
- **D-07:** Show read-only `embeddingDimensions` from GET (label「向量维度（只读）」+ muted note: 由环境变量 `EMBEDDING_DIMENSIONS` 决定)
- **D-08:** When `embeddingModel` form value **differs** from last loaded/saved value, show persistent warning banner (not only on submit):

  > 更改 Embedding 模型后，已入库向量可能与新模型不兼容。建议对重要文档重新上传/入库；本系统不会自动重建 Chroma 集合。

- **D-09:** On successful save, treat the new model as the baseline (warning clears until next edit)
- **D-10:** No extra CSS framework — reuse `.banner-error` / `.muted` / `.field`; optional `.banner-warning` if amber distinction is useful (discretion)

### Verification
- **D-11:** `@kb/web` has no Vitest — acceptance = `pnpm --filter @kb/web build` + manual smoke against running backend optional
- **D-12:** Do not add a test runner in this phase unless a tiny pure helper is extracted and tested from `@kb/backend` / `@kb/core` (prefer no new harness)

### Claude's Discretion
- Exact Chinese copy for labels/help text
- Whether rerank fields stay enabled-but-ignored vs disabled when toggle off

### Post-ship discuss (2026-07-20)
- **D-13:** Embedding **and** Rerank model settings are **admin-only** (`role=admin` or service `API_KEY`). Ordinary users may GET/view read-only. Context settings remain available to all authenticated users.
- **D-14:** `PATCH /api/v1/settings/models` uses `modelsRouteOpts` = `createAdminRouteOpts` when `USER_AUTH_ENABLED`; when user auth is off, same as general `routeOpts`.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — CONF-07, CONF-08
- `.planning/phases/19-model-settings-core/19-CONTEXT.md` — API shape
- `apps/backend/src/routes/settings.ts` — GET/PATCH contracts
- `apps/web/src/components/SettingsPanel.tsx` — existing patterns
- `apps/web/src/api/settings.ts` — client to extend
</canonical_refs>

<code_context>
## Existing Code Insights

### Ready
- Phase 19 REST: `models` + `embeddingDimensions` on GET; PATCH `/settings/models`
- SettingsPanel already uses react-query + form + banners

### Gaps
- Web `SettingsResponse` type outdated (missing models)
- No model form UI
</code_context>

<specifics>
## Locked Specifics

- Full body PATCH (same as context) — send all four model fields
- Dimensions never editable in UI
</specifics>
