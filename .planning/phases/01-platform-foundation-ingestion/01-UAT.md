---
status: complete
phase: 01-platform-foundation-ingestion
source:
  - 01-01-SUMMARY.md
  - 01-02-SUMMARY.md
  - 01-03-SUMMARY.md
started: 2026-06-30T13:45:00.000Z
updated: 2026-06-30T14:40:00.000Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill running services, start fresh with `pnpm dev` — Chroma (8000) and backend (3000) boot without errors
result: pass

### 2. Health Endpoints
expected: `curl http://127.0.0.1:3000/health` returns `{"status":"ok"}`; `/health/chroma` and `/health/embeddings` return status ok (embeddings includes model qwen/qwen3-embedding-8b)
result: pass

### 3. Ingest Text Document
expected: `pnpm ingest scripts/fixtures/sample.txt` prints JSON with documentId, chunkCount > 0, collection default
result: pass

### 4. Re-Ingest Same Document
expected: Re-running the same ingest command succeeds without duplicate-vector errors; prior chunks replaced
result: pass

### 5. Vector Persistence After Restart
expected: Stop `pnpm dev`, restart stack, previously ingested document vectors remain queryable in Chroma (registry shows indexed status)
result: pass

### 6. Scanned PDF Rejection
expected: Ingesting a PDF with insufficient extractable text fails with a clear error message (not a silent empty ingest)
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
