# Phase 4: Admin Surfaces & Security - Context

**Gathered:** 2026-07-04 (updated 2026-07-04 discuss Wave 3 Web)
**Status:** Ready for execution — Web UX decisions locked (zh-CN + 使用说明 tab)
**Source:** Research defaults + discuss Wave 2 CLI + discuss Wave 3 Web session

<domain>
## Phase Boundary

Phase 4 delivers the **admin trifecta** promised in PROJECT.md:

1. **Web admin** (`apps/web`) — upload, list, delete, test search via REST
2. **CLI** (`apps/cli`) — ingest files/directories, list, delete
3. **Optional API key auth** (`CONF-03`) — backend bearer gate; web + CLI respect same config

MCP remains retrieval-only. No new MCP tools. MCP HTTP auth deferred.

Ingestion and search logic stay in `@kb/core`; admin surfaces are thin REST clients (CLI may use direct core only when `AUTH_ENABLED=false`).
</domain>

<decisions>
## Implementation Decisions

### Web Stack
- Vite 8 + React 19 + TanStack Query 5 in `apps/web`
- Dev: Vite `:5173` with `server.proxy` `/api` → `http://127.0.0.1:3000`
- Prod: build to `apps/web/dist`, serve via `@fastify/static` from `@kb/backend` (same origin)

### Web UX (discuss 2026-07-04 — Wave 3)
- **Audience:** 小团队内部推广原型 — 面向非前端/运维同事，强调「能用、看得懂」
- **界面语言:** **简体中文** — 所有可见文案（按钮、空状态、错误、模态框、Tab 名）使用 zh-CN；实现时以 `04-UI-SPEC.md` 结构为准，**翻译** Copywriting Contract，不沿用英文原文
- **导航:** 三个 Tab — **文档** | **搜索** | **使用说明**（在 UI-SPEC 两 Tab 基础上增加第三 Tab，不新增路由）
- **使用说明 Tab:** 静态内嵌快速步骤（非外链 README），内容包括：
  1. 启动：`pnpm dev`，确认 Chroma / Backend / Web 就绪
  2. 上传：在「文档」页上传 `.txt` / `.md` / `.pdf`（文本层）
  3. 搜索：在「搜索」页输入问题、选择 topK、查看结果
  4. MCP：Cursor 配置 stdio 或 HTTP `3100` 调用 `search_knowledge`
- **不做的 Web 项（本波）:** 多文件上传队列、collection 选择器、processing 轮询、AUTH 详细教程（使用说明仅 quick steps）
- **视觉:** 仍遵循 UI-SPEC 间距/颜色/无 shadcn；仅语言与 Tab 结构按上调整

### CLI Stack
- Commander 15 in `apps/cli` with subcommands: `ingest`, `list`, `delete`
- **Command entry (discuss 2026-07-04):** both `kb` bin in `@kb/cli` AND root `pnpm ingest` alias → `@kb/cli ingest`
- Directory ingest: recursive walk, filter `.txt`, `.md`, `.markdown`, `.pdf`
- **`--collection` (discuss 2026-07-04):** supported on `ingest`; default `default` when omitted (same as current `scripts/ingest.ts`)

### CLI UX (discuss 2026-07-04 — Wave 2)
- **`list` output:** human-readable **table** — columns: `id`, `filename`, `status`, `chunkCount`, `collection`, `updatedAt` (no `--json` in v1)
- **Directory ingest progress:** **verbose** — one line per file (`ingesting <path> … ok` or `… fail: <message>`); final summary line with success/fail counts
- Exit codes unchanged: 0 success, 1 usage/validation, 2 API/network error

### Data Path
- **REST-first** for web list/delete/upload/search — guarantees corpus parity (roadmap criterion 5)
- CLI dual-path: REST multipart when `AUTH_ENABLED=true`; direct `@kb/core` allowed when `AUTH_ENABLED=false` (document in README)

### Auth (CONF-03)
- Extend `@kb/config` with `AUTH_ENABLED` (default `false`) and `API_KEY` (required when auth on)
- `@fastify/bearer-auth` with `addHook: false`; apply `preHandler: verifyBearerAuth` on `/api/v1/*` routes only
- `/health*`, `/docs` remain public
- Web: prompt on first `401`; store key in `sessionStorage` for session (not in Vite env)
- CLI: read `API_KEY` from env; send `Authorization: Bearer <API_KEY>` on all REST calls when auth on

### Deferred (Claude's Discretion)
- MCP HTTP bearer auth — out of Phase 4 scope
- Chunk size/overlap settings UI — no REST endpoint for SettingsStore yet
- Separate web server in production — use Fastify static only
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### REST API (Phase 2)
- `apps/backend/src/routes/documents.ts` — upload, list, get, delete
- `apps/backend/src/routes/search.ts` — POST `/api/v1/search`
- `apps/backend/src/routes/health.ts` — public health probes

### Config & Core
- `packages/config/src/env.ts` — extend for AUTH vars
- `packages/core/src/registry/types.ts` — DocumentRecord fields for list UI
- `scripts/ingest.ts` — migrate patterns to CLI

### Stack & Architecture
- `.planning/research/STACK.md` — Vite, React, Commander, bearer-auth versions
- `.planning/phases/04-admin-surfaces-security/04-RESEARCH.md` — Phase 4 technical research
</canonical_refs>

<specifics>
## Specific Ideas

- Document list shows: `id`, `filename`, `status`, `chunkCount`, `collection`, timestamps
- CLI `list` renders as fixed-width table (terminal-friendly)
- Directory ingest prints per-file progress lines before summary
- Search UI renders: `score`, `text`, `documentId`, `filename`, `chunkIndex`
- Web UI copy in **Simplified Chinese** (see Web UX section)
- Help tab title: **使用说明** with embedded quick-start steps for team onboarding
- Delete requires confirm dialog in web UI
- CLI exit codes: 0 success, 1 usage/validation, 2 API/network error
</specifics>

<deferred>
## Deferred Ideas

- MCP HTTP authentication
- Web UI for chunk settings override
- REST-only CLI ingest always (dual-path chosen for auth-off dev speed)
- English-only web UI (superseded by zh-CN discuss decision)
- External README link as primary onboarding (superseded by 使用说明 tab)
</deferred>

---

*Phase: 04-admin-surfaces-security*
*Context gathered: 2026-07-04 via research defaults*
