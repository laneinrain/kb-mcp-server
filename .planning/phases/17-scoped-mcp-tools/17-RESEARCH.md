# Phase 17: Scoped MCP Tools - Research

**Researched:** 2026-07-17

## SearchService ACL (already shipped)

```typescript
// SearchOptions
allowedDocumentIds?: ReadonlySet<string>;

// Filter after Chroma recall, before rerank
const allowed = options?.allowedDocumentIds;
if (allowed) {
  hits = hits.filter((h) => allowed.has(h.documentId));
}
```

MCP `search_knowledge` only needs to pass the option — no SearchService changes.

## ContextService ACL (new)

| Check order | Behavior |
|-------------|----------|
| 1. `getDocument` missing | `document_not_found` |
| 2. `allowedDocumentIds` defined && !has(id) | `document_not_found` (hide existence) |
| 3. Existing chunk/window logic | unchanged |

Matches REST document GET: cross-user → 404 not 403 (Phase 8 D-16).

## ALS availability matrix

| Transport | ALS set? | Tool ACL |
|-----------|----------|----------|
| HTTP `/mcp` | `runWithMcpCallerContext` per request | user / service / global |
| stdio | `enterMcpCallerContext` at startup | bound once |
| `server.test.ts` InMemory | often unset | treat as global (`undefined`) |

**Decision:** `getToolAllowedDocumentIds()` uses `mcpCallerStorage.getStore()` without throwing when missing.

## buildMcpServer signature

| Option | Pros | Cons |
|--------|------|------|
| **Call ALS inside handlers** | No signature churn; http/stdio unchanged | Implicit dependency |
| Inject `getContext` arg | Explicit DI | Update all call sites + tests |

**Decision:** ALS helper inside handlers (D-06) — Phase 16 already established ALS as the transport boundary.

## Test strategy

| Layer | Cases |
|-------|-------|
| ContextService unit | allow, deny→document_not_found, undefined→pass |
| MCP server (InMemory) | enter user context → search called with Set; service → no Set; no ALS → no Set |
| Regression | Existing server/http tests still green |

## Risks

| Risk | Mitigation |
|------|------------|
| Empty allowed set blocks all reads | Correct for users with no docs; search returns [] |
| Stale allowedDocumentIds after upload mid-session | HTTP re-resolves every request; stdio fixed until restart (documented Phase 18) |
| Accidental empty Set for service | Resolver returns undefined for service (Phase 16 D-07) — verify in 17-03 tests |
