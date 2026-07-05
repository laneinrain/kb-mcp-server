# Phase 9 Research: Filename Content-Hash Dedup

**Researched:** 2026-07-05  
**Phase:** 9 — Filename Content-Hash Dedup  
**Requirements:** INGE-10, INGE-11, INGE-12, INGE-13

## RESEARCH COMPLETE

## Executive Summary

Phase 9 replaces **path-based document IDs** (broken for Web uploads with UUID temp paths) with **stable IDs per `(user_id, filename)`** and stores **`content_hash`** of normalized parsed text. Re-upload with identical hash returns **`unchanged`** without embedding; different hash **`replaced`** old vectors.

## Key Technical Choices

| Topic | Choice |
|-------|--------|
| Hash input | Parsed text after `parseDocument`, before `chunkText` |
| Normalization | `\r\n` → `\n`, then `trim()` |
| Dedup key | `(userId, filename)` |
| Document ID | `sha256(userId + '\0' + filename)` for ingest dedup path |
| Unchanged | Skip embed + Chroma; return existing `documentId`, `chunkCount` |
| Replaced | `deleteByDocumentId` then full re-ingest on same id |
| Unique constraint | SQLite unique index on `(user_id, filename)` when migration safe |
| Legacy rows | Keep existing ids; `content_hash` NULL until re-upload |

## Current Gap (verified)

```typescript
// ingestion-service.ts — documentId from temp upload path
function deriveDocumentId(absolutePath: string): string {
  return createHash("sha256").update(normalize(resolve(absolutePath))).digest("hex");
}
```

Each Web upload → new UUID prefix → **always `created`**, never dedup.

## Target Flow

```
parseDocument(path) → text
normalize(text) → contentHash
existing = registry.findByUserAndFilename(userId, filename)
if existing && existing.contentHash === contentHash → return unchanged
if existing && different hash → delete vectors, replace
else → create with stable documentId
```

## Schema

```sql
ALTER TABLE documents ADD COLUMN content_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_user_filename
  ON documents(user_id, filename);
```

Handle pre-existing duplicate `(user_id, filename)` rows: detect in migration; skip index + log; app still uses `findByUserAndFilename` (pick latest `updated_at`).

## API Response Shape

```json
{
  "documentId": "...",
  "chunkCount": 42,
  "collection": "default",
  "status": "indexed",
  "outcome": "created" | "unchanged" | "replaced"
}
```

## Files to Touch

| Area | Files |
|------|-------|
| Registry | `schema.sql`, `types.ts`, `migrations.ts`, `document-registry.ts` |
| Ingestion | `ingestion-service.ts`, `ingestion-service.test.ts`, new `content-hash.ts` |
| Backend | `routes/documents.ts`, `routes/documents.test.ts`, dedup integration test |
| Web | `api/documents.ts`, `UploadPanel.tsx`, `types.ts` |
| CLI | `commands/ingest.ts`, `api-client.ts` |

## Risks

| Risk | Mitigation |
|------|------------|
| Legacy duplicate filenames same user | Migration probe; skip unique index; deterministic pick in lookup |
| Filename case sensitivity | Use basename as uploaded; document case-sensitive match (Windows uploads preserve case) |
| Collection change on re-upload | Replace path updates `collection` on row if option differs |
| Empty parsed text | Existing PDF rejection unchanged; hash of empty string still valid |

## Test Matrix

| Case | Expected outcome |
|------|------------------|
| First upload `a.md` | `created`, embed called |
| Same file again | `unchanged`, embed NOT called |
| Edit content, same name | `replaced`, embed called, old vectors deleted |
| Same content, different user | `created` (separate user scope) |

---
*Phase: 09-filename-content-hash-dedup*
