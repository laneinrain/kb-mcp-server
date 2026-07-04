---
phase: 04-admin-surfaces-security
plan: 03
subsystem: web
tags: [vite, react, tanstack-query, spa, zh-cn]

requires:
  - phase: 04-02
    provides: REST API patterns, Bearer auth when AUTH_ENABLED
provides:
  - "@kb/web Vite + React admin SPA"
  - Upload, document list/delete, test search via REST only
  - sessionStorage kb_api_key + 401 ApiKeyModal retry
  - Dev proxy /api → 127.0.0.1:3000 on :5173
affects: [04-04-static-spa]

tech-stack:
  added: ["react@19.2.7", "@tanstack/react-query@5.101.2", "vite@8.1.3"]
  patterns:
    - "Relative /api/v1 fetch with optional Bearer from sessionStorage"
    - "简体中文 UI copy per 04-CONTEXT discuss decisions"
    - "Three tabs: 文档 | 搜索 | 使用说明"

key-files:
  created:
    - apps/web/package.json
    - apps/web/vite.config.ts
    - apps/web/index.html
    - apps/web/src/main.tsx
    - apps/web/src/App.tsx
    - apps/web/src/App.css
    - apps/web/src/types.ts
    - apps/web/src/vite-env.d.ts
    - apps/web/src/api/client.ts
    - apps/web/src/api/documents.ts
    - apps/web/src/api/search.ts
    - apps/web/src/components/AppShell.tsx
    - apps/web/src/components/UploadPanel.tsx
    - apps/web/src/components/DocumentTable.tsx
    - apps/web/src/components/SearchPanel.tsx
    - apps/web/src/components/ApiKeyModal.tsx
    - apps/web/src/components/HelpPanel.tsx

requirements-completed: [WEB-01, WEB-02, WEB-03, WEB-04]

duration: 15min
completed: 2026-07-04
---

# Phase 4 Plan 03 Summary

**Plan:** 04-03 — Web admin SPA (WEB-01–WEB-04)  
**Status:** Complete  
**Date:** 2026-07-04

## Delivered

- **`@kb/web`** Vite + React 19 SPA with TanStack Query REST client
- **文档 tab:** drag-drop / 选择文件 upload (`.txt/.md/.markdown/.pdf`); document table with status, chunkCount, collection, updatedAt; delete confirm modal
- **搜索 tab:** query + topK 1–10; ranked result cards (score, filename, chunkIndex, snippet)
- **使用说明 tab:** static quick-start (pnpm dev → upload → search → MCP)
- **401 UX:** ApiKeyModal → `sessionStorage` key `kb_api_key` → single retry; invalid key reopens modal
- **Dev:** Vite `:5173` proxies `/api` → `http://127.0.0.1:3000`
- **No `@kb/core`** in browser bundle — REST-only data path

## Build

`pnpm --filter @kb/web build` — **passes**

## Discuss overrides applied

- 简体中文 for all UI copy (not English UI-SPEC strings)
- Third tab **使用说明** with static operator steps
- No collection picker, chunk settings, or AUTH tutorial in help

## Next

Wave 4 — 04-04 static serve from backend, extend `pnpm dev`, E2E checkpoint
