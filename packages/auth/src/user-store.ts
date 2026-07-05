import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type { AuthUser } from "./types.js";
import { SYSTEM_AUTH_SOURCE, SYSTEM_EMPLOYEE_ID } from "./constants.js";

interface UserRow {
  id: string;
  employee_id: string;
  email: string | null;
  password_hash: string | null;
  auth_source: "cas" | "local" | "system";
  created_at: string;
}

function mapRow(row: UserRow): AuthUser {
  return {
    id: row.id,
    employeeId: row.employee_id,
    email: row.email,
    authSource: row.auth_source,
    createdAt: row.created_at,
  };
}

function schemaPath(): string {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(dir, "schema.sql"),
    path.join(dir, "..", "src", "schema.sql"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error("auth schema.sql not found");
}

export function openAuthDatabase(dbPath: string): Database.Database {
  mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  const sql = readFileSync(schemaPath(), "utf8");
  db.exec(sql);
  return db;
}

export class UserStore {
  private readonly findByEmployeeIdStmt;
  private readonly findByIdStmt;
  private readonly insertCasUserStmt;
  private readonly insertSystemUserStmt;

  constructor(private readonly db: Database.Database) {
    this.findByEmployeeIdStmt = db.prepare(`
      SELECT id, employee_id, email, password_hash, auth_source, created_at
      FROM users WHERE employee_id = ?
    `);
    this.findByIdStmt = db.prepare(`
      SELECT id, employee_id, email, password_hash, auth_source, created_at
      FROM users WHERE id = ?
    `);
    this.insertCasUserStmt = db.prepare(`
      INSERT INTO users (id, employee_id, email, password_hash, auth_source)
      VALUES (@id, @employeeId, NULL, NULL, 'cas')
    `);
    this.insertSystemUserStmt = db.prepare(`
      INSERT INTO users (id, employee_id, email, password_hash, auth_source)
      VALUES (@id, @employeeId, NULL, NULL, @authSource)
    `);
  }

  findByEmployeeId(employeeId: string): AuthUser | undefined {
    const row = this.findByEmployeeIdStmt.get(employeeId) as UserRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  findById(id: string): AuthUser | undefined {
    const row = this.findByIdStmt.get(id) as UserRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  upsertCasUser(employeeId: string): AuthUser {
    const existing = this.findByEmployeeId(employeeId);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    this.insertCasUserStmt.run({ id, employeeId });
    return this.findByEmployeeId(employeeId)!;
  }

  ensureSystemUser(): AuthUser {
    const existing = this.findByEmployeeId(SYSTEM_EMPLOYEE_ID);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    this.insertSystemUserStmt.run({
      id,
      employeeId: SYSTEM_EMPLOYEE_ID,
      authSource: SYSTEM_AUTH_SOURCE,
    });
    return this.findByEmployeeId(SYSTEM_EMPLOYEE_ID)!;
  }
}
