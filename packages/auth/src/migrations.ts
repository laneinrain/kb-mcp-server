import type Database from "better-sqlite3";

function hasColumn(db: Database.Database, name: string): boolean {
  const columns = db
    .prepare("PRAGMA table_info(users)")
    .all() as Array<{ name: string }>;
  return columns.some((column) => column.name === name);
}

export function runAuthMigrations(db: Database.Database): void {
  if (!hasColumn(db, "role")) {
    db.exec(
      "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
    );
  }
  if (!hasColumn(db, "last_login_at")) {
    db.exec("ALTER TABLE users ADD COLUMN last_login_at TEXT");
  }
}
