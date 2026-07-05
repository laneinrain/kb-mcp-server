import type Database from "better-sqlite3";
import type {
  DocumentRecord,
  DocumentStatus,
  RegisterDocumentInput,
} from "./types.js";

interface DocumentRow {
  id: string;
  filename: string;
  source_path: string;
  mime_type: string;
  status: DocumentStatus;
  chunk_count: number;
  collection: string;
  user_id: string | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: DocumentRow): DocumentRecord {
  return {
    id: row.id,
    filename: row.filename,
    sourcePath: row.source_path,
    mimeType: row.mime_type,
    status: row.status,
    chunkCount: row.chunk_count,
    collection: row.collection,
    userId: row.user_id ?? "",
    contentHash: row.content_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface DocumentRegistry {
  registerDocument(meta: RegisterDocumentInput): DocumentRecord;
  updateStatus(
    id: string,
    status: DocumentStatus,
    chunkCount?: number,
  ): void;
  getDocument(id: string): DocumentRecord | undefined;
  findByUserAndFilename(
    userId: string,
    filename: string,
  ): DocumentRecord | undefined;
  listDocuments(): DocumentRecord[];
  listDocumentsForUser(userId: string, systemUserId: string): DocumentRecord[];
  deleteDocument(id: string): void;
  trackChunkIds(documentId: string, chromaIds: string[]): void;
  getChunkIds(documentId: string): string[];
}

export function getDocumentRegistry(db: Database.Database): DocumentRegistry {
  const upsertStmt = db.prepare(`
    INSERT INTO documents (
      id, filename, source_path, mime_type, status, chunk_count, collection, user_id, content_hash
    ) VALUES (
      @id, @filename, @sourcePath, @mimeType, @status, 0, @collection, @userId, @contentHash
    )
    ON CONFLICT(id) DO UPDATE SET
      filename = excluded.filename,
      source_path = excluded.source_path,
      mime_type = excluded.mime_type,
      collection = excluded.collection,
      user_id = excluded.user_id,
      content_hash = excluded.content_hash,
      updated_at = datetime('now')
  `);

  const selectStmt = db.prepare(`
    SELECT id, filename, source_path, mime_type, status, chunk_count,
           collection, user_id, content_hash, created_at, updated_at
    FROM documents WHERE id = ?
  `);

  const findByUserAndFilenameStmt = db.prepare(`
    SELECT id, filename, source_path, mime_type, status, chunk_count,
           collection, user_id, content_hash, created_at, updated_at
    FROM documents
    WHERE user_id = @userId AND filename = @filename
    ORDER BY updated_at DESC
    LIMIT 1
  `);

  const listStmt = db.prepare(`
    SELECT id, filename, source_path, mime_type, status, chunk_count,
           collection, user_id, content_hash, created_at, updated_at
    FROM documents ORDER BY created_at DESC
  `);

  const listForUserStmt = db.prepare(`
    SELECT id, filename, source_path, mime_type, status, chunk_count,
           collection, user_id, content_hash, created_at, updated_at
    FROM documents
    WHERE user_id = @userId OR user_id = @systemUserId
    ORDER BY created_at DESC
  `);

  const deleteStmt = db.prepare("DELETE FROM documents WHERE id = ?");

  const updateStatusStmt = db.prepare(`
    UPDATE documents
    SET status = @status,
        chunk_count = COALESCE(@chunkCount, chunk_count),
        updated_at = datetime('now')
    WHERE id = @id
  `);

  const insertChunkStmt = db.prepare(`
    INSERT INTO document_chunks (document_id, chunk_index, chroma_id)
    VALUES (@documentId, @chunkIndex, @chromaId)
    ON CONFLICT(document_id, chunk_index) DO UPDATE SET chroma_id = excluded.chroma_id
  `);

  const selectChunksStmt = db.prepare(`
    SELECT chroma_id FROM document_chunks
    WHERE document_id = ?
    ORDER BY chunk_index ASC
  `);

  return {
    registerDocument(meta: RegisterDocumentInput): DocumentRecord {
      upsertStmt.run({
        id: meta.id,
        filename: meta.filename,
        sourcePath: meta.sourcePath,
        mimeType: meta.mimeType,
        status: meta.status ?? "pending",
        collection: meta.collection,
        userId: meta.userId,
        contentHash: meta.contentHash ?? null,
      });

      const row = selectStmt.get(meta.id) as DocumentRow | undefined;
      if (!row) {
        throw new Error(`Failed to register document ${meta.id}`);
      }
      return mapRow(row);
    },

    updateStatus(id, status, chunkCount) {
      updateStatusStmt.run({ id, status, chunkCount: chunkCount ?? null });
    },

    getDocument(id) {
      const row = selectStmt.get(id) as DocumentRow | undefined;
      return row ? mapRow(row) : undefined;
    },

    findByUserAndFilename(userId, filename) {
      const row = findByUserAndFilenameStmt.get({
        userId,
        filename,
      }) as DocumentRow | undefined;
      return row ? mapRow(row) : undefined;
    },

    listDocuments() {
      const rows = listStmt.all() as DocumentRow[];
      return rows.map(mapRow);
    },

    listDocumentsForUser(userId, systemUserId) {
      const rows = listForUserStmt.all({ userId, systemUserId }) as DocumentRow[];
      return rows.map(mapRow);
    },

    deleteDocument(id) {
      deleteStmt.run(id);
    },

    trackChunkIds(documentId, chromaIds) {
      const track = db.transaction((ids: string[]) => {
        for (let index = 0; index < ids.length; index += 1) {
          insertChunkStmt.run({
            documentId,
            chunkIndex: index,
            chromaId: ids[index],
          });
        }
      });
      track(chromaIds);
    },

    getChunkIds(documentId) {
      const rows = selectChunksStmt.all(documentId) as { chroma_id: string }[];
      return rows.map((row) => row.chroma_id);
    },
  };
}
