# Phase 9: Filename Content-Hash Dedup - Context

**Gathered:** 2026-07-05
**Status:** Ready for planning (derived from REQUIREMENTS + PROJECT.md; no discuss-phase session)

<domain>
## Phase Boundary

Add **content-hash deduplication** keyed by **`(user_id, filename)`** so re-uploading the same filename skips re-embedding when parsed text is unchanged, and replaces vectors when content differs.

**In scope:** INGE-10, INGE-11, INGE-12, INGE-13.

**Out of scope:** Cross-filename dedup; MCP auth changes; async job queue; OCR; changing search algorithm; dedup across users (same file uploaded by two users remains two documents).

**Depends on:** Phase 8 `user_id` on documents and JWT/API upload paths.
</domain>

<decisions>
## Implementation Decisions

### Content hash (INGE-10)
- **D-01:** `content_hash` = SHA-256 hex of **normalized parsed text** (after `parseDocument`, before `chunkText`).
- **D-02:** Normalization (minimal, deterministic): `text.replace(/\r\n/g, '\n').trim()` — no chunking-specific transforms.

### Lookup key (INGE-11, INGE-12)
- **D-03:** Dedup key is **`(userId, filename)`** where `filename` is the operator-facing basename (upload `options.filename` or parsed basename).
- **D-04:** Stable **`documentId`** for dedup path = `sha256(userId + '\0' + filename)` (replaces path-based id for new ingest flow). Legacy rows keep existing ids until replaced.

### Outcomes (INGE-13)
- **D-05:** `IngestResult.outcome`: `'created' | 'unchanged' | 'replaced'`.
- **D-06:** **unchanged** — return existing row; **no** `embedDocuments` / **no** Chroma upsert.
- **D-07:** **replaced** — delete prior Chroma vectors for that `documentId`, update registry row + re-chunk/embed.
- **D-08:** **created** — first `(userId, filename)` pair; full ingest pipeline.

### HTTP / UX
- **D-09:** POST `/api/v1/documents` response includes `outcome` (+ existing fields). Status: **201** for `created`, **200** for `unchanged` and `replaced`.
- **D-10:** Web `UploadPanel` messages: 已上传 / 内容未变，跳过索引 / 内容已更新并重新索引.
- **D-11:** CLI stderr log includes JSON with `outcome`.

### Legacy / migration
- **D-12:** Add nullable `content_hash TEXT` column; no backfill required for old rows.
- **D-13:** Add **unique index** on `(user_id, filename)` when migration safe; if duplicate legacy rows exist for same pair, log count and skip index (app-level lookup still enforced).
- **D-14:** Path-based `deriveDocumentId(absolutePath)` removed from ingest hot path — dedup authority is `(userId, filename)`.

### Unchanged surfaces
- **D-15:** MCP tools unchanged — global search corpus semantics.
- **D-16:** Delete/list/search scoping from Phase 8 unchanged.
</decisions>

<specifics>
## Specific Ideas

- User pain: Web re-upload same PDF creates duplicate rows and wasted embedding cost — fixed by unchanged path.
- Phase 8 upload path fix (DATA_DIR) is prerequisite; dedup builds on stable filename + user scope.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/REQUIREMENTS.md` — INGE-10–13
- `.planning/PROJECT.md` — v1.2 hash on parsed text keyed by `(user_id, filename)`
- `.planning/research/PITFALLS.md` — re-upload duplicate vectors
- `packages/core/src/ingestion/ingestion-service.ts`
- `packages/core/src/registry/document-registry.ts`
- `apps/backend/src/routes/documents.ts`
- `apps/web/src/components/UploadPanel.tsx`
</canonical_refs>

<deferred>
## Deferred

- Content-hash dedup for **same content, different filename**
- Batch CLI mtime-based skip (PLAT-02 broader incremental index)
</deferred>

---
*Phase: 09-filename-content-hash-dedup*
