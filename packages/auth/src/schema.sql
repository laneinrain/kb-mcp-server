CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email TEXT UNIQUE,
  password_hash TEXT,
  auth_source TEXT NOT NULL DEFAULT 'cas',
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users(employee_id);
