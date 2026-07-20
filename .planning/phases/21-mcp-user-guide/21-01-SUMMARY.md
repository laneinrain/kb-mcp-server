# Plan 21-01 Summary: Help User Guide Structure

**Completed:** 2026-07-20  
**Requirement:** DOCS-01  
**Status:** ✅ Done

## Delivered

- HelpPanel restructured: 快速开始、鉴权与文档范围、MCP 工具
- Tables for auth matrix + three tools (`search_knowledge` / `read_around` / `read_file`)
- CSS: `.help-section`, `.help-table`, `pre.mono`
- Stub section for client recipes (filled in 21-02/21-03)

## Verification

```
pnpm --filter @kb/web build  # ok
```

## Next

Execute **21-02** — Cursor / CodeBuddy JWT recipes.
