# Phase 15 Summary

**Completed:** 2026-07-16  
**Phase:** Config & Documentation

## Delivered

- `RERANK_MODEL` env var (default `qwen/qwen3-reranker-0.6b`) wired through `SearchService`
- README: 检索与 Rerank section, architecture diagram, env table
- `.env.example`: rerank settings with two-stage retrieval comments
- SearchService.create integration tests (rerank on/off, model passthrough)
- `env.test.ts` asserts rerank defaults

## Requirements

- RETR-11, RETR-12, RETR-13
