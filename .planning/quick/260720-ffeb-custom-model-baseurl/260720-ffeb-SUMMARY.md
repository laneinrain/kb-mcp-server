---
status: complete
quick_id: "260720-ffeb"
slug: custom-model-baseurl
completed: 2026-07-20
---

# Quick Summary: Custom embedding/rerank Base URL + model (admin)

## Delivered

- `ModelConfig` adds `embeddingBaseUrl` / `rerankBaseUrl` (SQLite migrate + seed from `CHERRYIN_BASE_URL`)
- REST GET/PATCH `/api/v1/settings/models` includes base URLs (admin gate unchanged)
- `EmbeddingClient` / `RerankClient` resolve endpoints from settings at runtime
- Web「设置」admin form: Embedding/Rerank Base URL + model; API Key 仍用 env `CHERRYIN_API_KEY`
- Embedding URL/model change warning retained

## Verify

```
@kb/core vitest: settings-store, embedding-client, rerank-client, search-service — pass
@kb/backend vitest: settings.test.ts — pass
@kb/web build — pass
```
