# Phase 21: MCP User Guide (Help) - Context

**Gathered:** 2026-07-20  
**Status:** Ready for execution

<domain>
## Phase Boundary

Upgrade Web「使用说明」into a structured **User Guide** covering upload/search basics, auth matrix, MCP tools, and **JWT-based MCP setup for Cursor and CodeBuddy**, plus a **copy current JWT** control.

**In scope:** DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05

**Out of scope:** Long-lived MCP token product; OAuth; changing MCP server code; README overhaul (optional one-line pointer OK)

**Unchanged:** Settings model admin gate (Phase 20); MCP auth semantics (v1.5)
</domain>

<decisions>
## Implementation Decisions

### Help structure (DOCS-01)
- **D-01:** Replace short `<ol>` with sectioned User Guide (简体中文):
  1. 快速开始（上传 / 搜索）
  2. 鉴权与文档范围（矩阵摘要）
  3. MCP 工具说明（`search_knowledge` / `read_around` / `read_file`）
  4. 客户端接入 — Cursor
  5. 客户端接入 — CodeBuddy
  6. 复制 JWT（操作区）
- **D-02:** Keep existing CSS classes (`.help-panel`, `.mono`, `.muted`); add minimal styles only if needed for `<pre>` config blocks / copy button

### Cursor (DOCS-02)
- **D-03:** Document **HTTP** (recommended for JWT): `url` + `headers.Authorization: Bearer <jwt>` → `http://127.0.0.1:3100/mcp`
- **D-04:** Document **stdio** alternative: `MCP_USER_TOKEN` env + `pnpm --filter @kb/mcp-server dev:stdio` (or dist path)
- **D-05:** Show example JSON in `<pre className="mono">` (or copyable block); placeholders `<jwt>` never commit secrets

### CodeBuddy (DOCS-03)
- **D-06:** Same credential model as Cursor (HTTP Bearer or stdio env). Document CodeBuddy MCP / 自定义 MCP 配置入口以「JSON 配置」形态给出等价示例（url + headers），并注明：若 UI 字段名不同，填入相同 URL 与 Authorization 头即可
- **D-07:** Do not invent proprietary CodeBuddy APIs — parity with Cursor Streamable HTTP pattern

### Copy JWT (DOCS-04)
- **D-08:** Button「复制当前登录 JWT」reads `getAccessToken()` from `auth-token.ts`
- **D-09:** On success: brief status「已复制」; if no token: show error「未登录或令牌缺失」
- **D-10:** Security notes adjacent: JWT 等同登录态；勿提交到仓库/聊天公开频道；过期后需重新登录再复制；stdio 为进程级单用户

### Auth matrix (DOCS-05)
- **D-11:** Compact table in Help matching README v1.5:
  | 凭据 | 文档范围 |
  | JWT | 自己的文档 + 系统共享 |
  | API_KEY | 全局（服务账号） |
  | 无 | 401 / stdio 启动失败 |

### Claude's Discretion
- Exact Chinese wording
- Whether to use `navigator.clipboard.writeText` with textarea fallback
- Collapsible `<details>` for long JSON (optional)
</decisions>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — DOCS-01–05
- `README.md` — MCP 配置 / 鉴权矩阵
- `apps/web/src/components/HelpPanel.tsx`
- `apps/web/src/lib/auth-token.ts` — `getAccessToken`
- `.cursor/mcp.json` — current HTTP stub (no headers yet)
</canonical_refs>

<code_context>
## Existing Code Insights

### Ready
- HelpPanel is a simple static component
- JWT already in localStorage via login
- README has full Cursor recipes to adapt into 中文 Web copy

### Gaps
- Help lacks JWT / CodeBuddy / copy token
- Repo `.cursor/mcp.json` has no Authorization header example (docs only — do not put real tokens in repo file)
</code_context>

<specifics>
## Locked Specifics

- Copy **current session** JWT only — no token minting API
- Guide lives in Web Help tab, not a new route
</specifics>
