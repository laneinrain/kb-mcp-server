# Plan 21-02 Summary: Cursor / CodeBuddy MCP Recipes

**Completed:** 2026-07-20  
**Requirements:** DOCS-02, DOCS-03, DOCS-05  
**Status:** ✅ Done

## Delivered

- Expanded auth matrix (Web / MCP HTTP / stdio / CLI)
- Cursor: HTTP Bearer + stdio `MCP_USER_TOKEN` JSON examples
- CodeBuddy: same semantics + HTTP/stdio examples
- Placeholders `<jwt>` only; warn against committing tokens

## Verification

```
pnpm --filter @kb/web build  # ok
```

## Next

Execute **21-03** — Copy current JWT button.
