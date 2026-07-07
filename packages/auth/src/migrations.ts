import type Database from "better-sqlite3";

function hasRoleColumn(db: Database.Database): boolean {
  const columns = db
    .prepare("PRAGMA table_info(users)")
    .all() as Array<{ name: string }>;
  return columns.some((column) => column.name === "role");
}

export function runAuthMigrations(db: Database.Database): void {
  if (!hasRoleColumn(db)) {
    db.exec(
      "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'",
    );
  }
}
