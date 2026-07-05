import type Database from "better-sqlite3";

export function runRegistryMigrations(
  db: Database.Database,
  systemUserId: string,
): number {
  const columns = db
    .prepare("PRAGMA table_info(documents)")
    .all() as { name: string }[];
  const names = new Set(columns.map((column) => column.name));

  if (!names.has("user_id")) {
    db.exec("ALTER TABLE documents ADD COLUMN user_id TEXT");
  }

  if (!names.has("content_hash")) {
    db.exec("ALTER TABLE documents ADD COLUMN content_hash TEXT");
  }

  let backfilled = 0;
  if (systemUserId) {
    const result = db
      .prepare("UPDATE documents SET user_id = ? WHERE user_id IS NULL")
      .run(systemUserId);
    backfilled = result.changes;
  }

  const duplicatePairs = db
    .prepare(
      `SELECT user_id, filename, COUNT(*) AS count
       FROM documents
       WHERE user_id IS NOT NULL AND filename IS NOT NULL
       GROUP BY user_id, filename
       HAVING count > 1`,
    )
    .all() as { count: number }[];

  if (duplicatePairs.length === 0) {
    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_user_filename
      ON documents(user_id, filename)
    `);
  } else {
    console.warn(
      `[kb] Skipped unique index on (user_id, filename): ${duplicatePairs.length} duplicate pair(s)`,
    );
  }

  return backfilled;
}
