---
status: active
quick_id: "260720-ffeb"
slug: custom-model-baseurl
created: 2026-07-20
---

# Quick Plan: Custom embedding/rerank Base URL + model (admin)

## Goal

管理员可在 Web「设置」配置 **Embedding（向量）** 与 **Rerank（服务/精排）** 的 **Base URL** 与 **模型名称**，运行时使用 settings 而非仅 env `CHERRYIN_BASE_URL`。便于后续接入非 CherryIn 的 OpenAI 兼容 / rerank 端点。API Key 本任务仍读 env `CHERRYIN_API_KEY`。

## Tasks

### 1. Persist base URLs in ModelConfig

- Extend `ModelConfig` with `embeddingBaseUrl`, `rerankBaseUrl`
- Migrate SQLite columns; seed from `CHERRYIN_BASE_URL`
- Validate: non-empty, `http://` or `https://`
- REST GET/PATCH `/settings/models` include new fields (admin gate unchanged)

### 2. Runtime clients read settings URLs

- `EmbeddingClient`: resolve `baseURL` (+ model) from settings each call / cached by URL
- `RerankClient`: resolve base URL from settings for `{base}/rerank`
- Wire backend + MCP services

### 3. Admin Web form

- Settings panel: Base URL fields for embedding + rerank; admin-only edit (existing gate)
- Note: API Key 仍由环境变量配置；端点可为任意 OpenAI 兼容 /v1 与 `/rerank`
- Warn when embedding model **or** base URL changes

## Done when

- Admin can save custom URLs + model IDs; non-admin read-only
- Search/ingest use settings URLs
- Unit tests for store + clients updated
