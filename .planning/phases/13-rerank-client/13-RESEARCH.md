# Phase 13: Rerank Client - Research

**Researched:** 2026-07-16

## CherryIn Rerank API

| Item | Value |
|------|-------|
| Provider | CherryIn (`open.cherryin.cc`) — same as embeddings |
| Model | `qwen/qwen3-reranker-0.6b` (user-specified, free tier) |
| Expected endpoint | `POST {CHERRYIN_BASE_URL}/rerank` |
| Auth | `Authorization: Bearer <CHERRYIN_API_KEY>` |

### Request (Cohere/Jina convention)

```json
{
  "model": "qwen/qwen3-reranker-0.6b",
  "query": "What is RAG?",
  "documents": ["chunk text 1", "chunk text 2"],
  "top_n": 5
}
```

### Response (expected)

```json
{
  "id": "rerank-...",
  "results": [
    { "index": 0, "relevance_score": 0.98 },
    { "index": 1, "relevance_score": 0.12 }
  ]
}
```

### Alternate shapes (validate in live test)

| Provider style | Endpoint | Notes |
|----------------|----------|-------|
| Cohere/Jina | `/v1/rerank` | `index` + `relevance_score` |
| Qwen Cloud | `/v1/reranks` | May use `data[].index` + `relevance_score` |

**Decision:** Implement Cohere/Jina parser first (D-02). Phase 13 live test (`13-02`) validates CherryIn; adjust parser if response differs.

## HTTP Client Choice

| Option | Pros | Cons |
|--------|------|------|
| **native fetch** | No new deps; testable via injection | Manual error handling |
| OpenAI SDK | Consistent with EmbeddingClient | No rerank API in SDK |
| axios | Familiar | Extra dependency |

**Decision:** `fetch` with injectable `fetchFn` — matches lightweight core package style.

## Retry Pattern (from EmbeddingClient)

```typescript
const MAX_RETRIES = 3;
// on 429: sleep(2 ** attempt * 250)
```

## Test Strategy

| Layer | Coverage |
|-------|----------|
| Unit | Empty docs, top_n, response mapping, 429 retry, error throw |
| Live | `skipIf(!CHERRYIN_API_KEY)` — smoke rerank 2 documents |

## Risks

| Risk | Mitigation |
|------|------------|
| CherryIn endpoint shape differs | Live test in 13-02; flexible parser |
| Rerank latency | Phase 14 only calls once per search; not Phase 13 concern |
| Large document arrays | Phase 14 caps at `RERANK_CANDIDATES` (30); client accepts any length |
| Model name mismatch | Constant `RERANK_MODEL`; override in tests |
