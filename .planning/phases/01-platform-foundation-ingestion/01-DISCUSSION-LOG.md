# Phase 1: Platform Foundation & Ingestion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-29
**Phase:** 1-Platform Foundation & Ingestion
**Areas discussed:** Chunking Strategy

---

## Chunking Strategy

### Q1: Default chunk size

| Option | Description | Selected |
|--------|-------------|----------|
| 512 tokens | Finer granularity, more chunks | |
| 800 tokens | Balanced default (recommended in prompt) | |
| 1024 tokens | Larger chunks, fewer embeddings | ✓ |
| You decide | Claude picks | |

**User's choice:** 1024 tokens (~4000 characters)

### Q2: Overlap

| Option | Description | Selected |
|--------|-------------|----------|
| 10% (~100 tokens) | Minimal overlap | |
| 15% (~150 tokens) | Balanced (recommended) | ✓ |
| 20% (~200 tokens) | Higher overlap | |
| You decide | Claude picks | |

**User's choice:** 15% (~150 tokens)

### Q3: Markdown splitting

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed sliding window | Same as txt/PDF, simple v1 | |
| Heading hierarchy | Split on #/## first | |
| Hybrid threshold | Short docs whole, long windowed | |
| You decide | Claude picks | ✓ |

**User's choice:** You decide → **Fixed sliding window for v1** (heading-aware deferred to v1.x)

### Q4: Configuration surface

| Option | Description | Selected |
|--------|-------------|----------|
| Environment variables only | Global CHUNK_SIZE/OVERLAP | |
| Env + per-ingest override | Optional runtime params | |
| Hardcoded constants | Simplest | |
| Web page configuration | User freeform request | ✓ |

**User's choice:** Web page configuration — user stated "web上面可以进行页面配置"
**Notes:** Phase 1 establishes persisted ChunkConfig + env defaults; Web settings UI deferred to Phase 4. Saved settings apply to subsequent ingests only.

---

## Claude's Discretion

- Markdown v1: fixed sliding window (user delegated Q3)
- Undiscussed gray areas (monorepo layout, registry, dev UX, PDF threshold): research defaults applied in CONTEXT.md

## Deferred Ideas

- Heading-aware markdown chunking → v1.x
- Other gray areas (1, 3, 4, 5, 6) not selected for discussion — planner uses research defaults
