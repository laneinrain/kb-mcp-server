---
phase: 04-admin-surfaces-security
plan: 04
subsystem: integration
tags: [fastify-static, turbo, dev-orchestration, e2e]

requires:
  - phase: 04-03
    provides: "@kb/web SPA built to apps/web/dist"
provides:
  - Production SPA static serve from @kb/backend (same origin)
  - Root pnpm dev includes @kb/web Vite dev server
  - turbo @kb/backend#build depends on @kb/web#build
affects: []

tech-stack:
  added: ["@fastify/static@9.1.3"]
  patterns:
    - "registerWebStatic after API routes; SPA fallback for non-/api/* 404s"
    - "SERVE_WEB=true for local prod smoke without NODE_ENV=production"

key-files:
  created:
    - apps/backend/src/static.ts
    - apps/backend/src/static.test.ts
  modified:
    - apps/backend/src/index.ts
    - apps/backend/package.json
    - apps/backend/src/auth.ts
    - apps/backend/src/routes/documents.ts
    - apps/backend/src/routes/search.ts
    - package.json
    - turbo.json
    - packages/core/src/embeddings/embedding-client.test.ts
    - packages/core/src/registry/settings-store.test.ts
    - packages/core/src/vector-store/chroma-store.test.ts

requirements-completed: []

duration: 10min
completed: 2026-07-04
e2e_status: approved
---

# Phase 4 Plan 04 Summary

**Plan:** 04-04 — Static serve, dev orchestration, E2E  
**Status:** Task 1 complete — **E2E 已通过（04-UAT 7/8 pass，1 skip）**  
**Date:** 2026-07-04

## Delivered (Task 1)

- **`apps/backend/src/static.ts`**: `@fastify/static` 服务 `apps/web/dist`；`/api/*` 404 返回 JSON；其余路径 SPA fallback 到 `index.html`
- **启用条件**: `NODE_ENV=production` 或 `SERVE_WEB=true`
- **根 `pnpm dev`**: 同时启动 Chroma、backend、MCP、**@kb/web**（`:5173`）
- **`dev:web`**: 单独启动 Vite 开发服务器
- **`turbo.json`**: `@kb/backend#build` 依赖 `@kb/web#build`
- **构建修复**: core 测试 mock 补 `AUTH_ENABLED`；backend `ApiRouteOpts` 类型修正

## 自动化验证

| 检查 | 结果 |
|------|------|
| `pnpm --filter @kb/web build` | 通过 |
| `pnpm --filter @kb/backend test` | 18/18 通过 |
| `pnpm turbo run build --filter=@kb/backend` | 通过（web 先于 backend 构建） |

## 待确认 (Task 2 — 人工 E2E)

请按下方步骤验证后回复 **approved** 或描述问题。

## Next

Operator E2E 通过后 → Phase 4 完成，更新 ROADMAP/STATE
