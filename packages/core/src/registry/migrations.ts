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

  if (systemUserId) {
    const result = db
      .prepare("UPDATE documents SET user_id = ? WHERE user_id IS NULL")
      .run(systemUserId);

    return result.changes;
  }

  return 0;
}
