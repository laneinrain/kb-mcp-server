# Phase 9 Patterns

**Phase:** 09 — Filename Content-Hash Dedup  
**Analog phases:** 01-02 (ingestion), 08-01 (registry migration)

## Closest Analogs

| New work | Closest existing file | Pattern |
|----------|----------------------|---------|
| `content_hash` column | Phase 8 `user_id` migration | `runRegistryMigrations()` idempotent ALTER |
| Registry lookup | `getDocument(id)` | Add `findByUserAndFilename(userId, filename)` |
| Ingest branching | `ingestion-service.test.ts` mocks | Mock embed/upsert; assert call counts |
| API outcome field | POST documents 201 body | Extend JSON; 200 for unchanged/replaced |
| Web success copy | `UploadPanel.tsx` | Branch on `outcome` in mutation onSuccess |

## Conventions to Follow

- Export hash helper from `@kb/core` (`computeContentHash`, `normalizeParsedText`)
- Extend `IngestResult` and registry types — no parallel DTOs
- Tests in `packages/core` for dedup logic; backend `app.inject` for HTTP outcome
- Error shape unchanged `{ error, message }`

## Anti-patterns

- Do **not** keep path-based id as primary dedup key for Web uploads
- Do **not** re-embed on `unchanged` (INGE-11 violation)
- Do **not** add MCP tool changes this phase

---
*Phase: 09-filename-content-hash-dedup*
