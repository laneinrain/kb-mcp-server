# Phase 20: Web Model Settings UI - Research

**Researched:** 2026-07-20

## REST contract (already shipped)

```json
GET /api/v1/settings
{
  "chunk": { "chunkSize": 1024, "chunkOverlap": 154 },
  "context": { ... },
  "models": {
    "embeddingModel": "qwen/qwen3-embedding-8b",
    "rerankEnabled": true,
    "rerankModel": "qwen/qwen3-reranker-0.6b",
    "rerankCandidates": 30
  },
  "embeddingDimensions": 1024
}
```

```http
PATCH /api/v1/settings/models
Content-Type: application/json

{ "embeddingModel", "rerankEnabled", "rerankModel", "rerankCandidates" }
→ { "models": { ... } }
```

## UI state sketch

```typescript
const [modelForm, setModelForm] = useState<ModelSettings>(...);
const [savedEmbeddingModel, setSavedEmbeddingModel] = useState<string>("");

useEffect(() => {
  if (data?.models) {
    setModelForm(data.models);
    setSavedEmbeddingModel(data.models.embeddingModel);
  }
}, [data]);

const embeddingChanged =
  modelForm.embeddingModel.trim() !== savedEmbeddingModel.trim();
```

## Checkbox pattern

Prefer controlled checkbox:

```tsx
<input
  type="checkbox"
  checked={modelForm.rerankEnabled}
  onChange={(e) => updateModelField("rerankEnabled", e.target.checked)}
/>
```

When disabled, still include `rerankModel` / `rerankCandidates` in PATCH so server state stays coherent.

## Smoke checklist (manual)

1. Open 设置 → see Embedding / Rerank section populated
2. Toggle rerank off → save → search should skip rerank (Backend already wired)
3. Change embedding model → warning appears → save → warning clears
4. Dimensions field read-only

## Risk

| Risk | Mitigation |
|------|------------|
| Stale Web types break build after Phase 19 API | Update `SettingsResponse` first |
| Two forms share one error banner | Separate error/success state keys or clear on each mutation |
