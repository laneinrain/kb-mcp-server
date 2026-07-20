# Phase 21: MCP User Guide - Research

**Researched:** 2026-07-20

## Cursor HTTP mcp.json (JWT)

```json
{
  "mcpServers": {
    "kb-mcp-server": {
      "url": "http://127.0.0.1:3100/mcp",
      "headers": {
        "Authorization": "Bearer <jwt>"
      }
    }
  }
}
```

## Cursor stdio

```json
{
  "mcpServers": {
    "kb-mcp-server": {
      "command": "pnpm",
      "args": ["--filter", "@kb/mcp-server", "dev:stdio"],
      "env": {
        "DOTENV_CONFIG_QUIET": "true",
        "MCP_USER_TOKEN": "<jwt>"
      }
    }
  }
}
```

(Run from monorepo root so workspace + `.env` resolve.)

## CodeBuddy

CodeBuddy / 同类 IDE 的 MCP 配置通常为 JSON：Streamable HTTP 填 URL + 自定义 Header，或命令行 + 环境变量。Help 中给出与 Cursor **相同字段语义** 的示例即可，避免绑定未公开的专有 schema。

## Copy JWT UX

```typescript
const token = getAccessToken();
if (!token) { setStatus("error"); return; }
await navigator.clipboard.writeText(token);
setStatus("copied");
```

Fallback: temporary `textarea` + `document.execCommand("copy")` if Clipboard API blocked (HTTP non-secure context edge case — localhost usually OK).

## CSS

Prefer:

```css
.help-panel pre.mono {
  overflow-x: auto;
  padding: 12px;
  background: #f4f4f5;
  border-radius: 8px;
  font-size: 12px;
}
.help-panel .help-section { margin-top: 24px; }
```

## Verification

`pnpm --filter @kb/web build` — no Vitest in web package.
