import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import type { AuthUser, UserRole } from "./types.js";
import {
  ADMIN_EMPLOYEE_ID,
  isReservedEmployeeId,
  SYSTEM_AUTH_SOURCE,
  SYSTEM_EMPLOYEE_ID,
} from "./constants.js";
import { AuthConflictError, AuthValidationError } from "./errors.js";
import { runAuthMigrations } from "./migrations.js";

interface UserRow {
  id: string;
  employee_id: string;
  email: string | null;
  password_hash: string | null;
  auth_source: "cas" | "local" | "system";
  role: UserRole;
  created_at: string;
}

function mapRow(row: UserRow): AuthUser {
  return {
    id: row.id,
    employeeId: row.employee_id,
    email: row.email,
    authSource: row.auth_source,
    role: row.role ?? "user",
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
  runAuthMigrations(db);
  return db;
}

const USER_SELECT = `
  SELECT id, employee_id, email, password_hash, auth_source, role, created_at
  FROM users
`;

export class UserStore {
  private readonly findByEmployeeIdStmt;
  private readonly findByIdStmt;
  private readonly insertCasUserStmt;
  private readonly insertSystemUserStmt;
  private readonly insertLocalUserStmt;

  constructor(private readonly db: Database.Database) {
    this.findByEmployeeIdStmt = db.prepare(`${USER_SELECT} WHERE employee_id = ?`);
    this.findByIdStmt = db.prepare(`${USER_SELECT} WHERE id = ?`);
    this.insertCasUserStmt = db.prepare(`
      INSERT INTO users (id, employee_id, email, password_hash, auth_source, role)
      VALUES (@id, @employeeId, NULL, NULL, 'cas', 'user')
    `);
    this.insertSystemUserStmt = db.prepare(`
      INSERT INTO users (id, employee_id, email, password_hash, auth_source, role)
      VALUES (@id, @employeeId, NULL, NULL, @authSource, 'user')
    `);
    this.insertLocalUserStmt = db.prepare(`
      INSERT INTO users (id, employee_id, email, password_hash, auth_source, role)
      VALUES (@id, @employeeId, NULL, @passwordHash, 'local', @role)
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

  findRowByEmployeeId(employeeId: string): UserRow | undefined {
    return this.findByEmployeeIdStmt.get(employeeId) as UserRow | undefined;
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

  ensureAdminUser(passwordHash: string): AuthUser {
    const existing = this.findByEmployeeId(ADMIN_EMPLOYEE_ID);
    if (existing) {
      return existing;
    }
    const id = randomUUID();
    this.insertLocalUserStmt.run({
      id,
      employeeId: ADMIN_EMPLOYEE_ID,
      passwordHash,
      role: "admin",
    });
    return this.findByEmployeeId(ADMIN_EMPLOYEE_ID)!;
  }

  registerLocalUser(params: {
    employeeId: string;
    passwordHash: string;
  }): AuthUser {
    if (isReservedEmployeeId(params.employeeId)) {
      throw new AuthValidationError("该工号不可注册");
    }
    if (this.findByEmployeeId(params.employeeId)) {
      throw new AuthConflictError("工号已存在");
    }
    const id = randomUUID();
    this.insertLocalUserStmt.run({
      id,
      employeeId: params.employeeId,
      passwordHash: params.passwordHash,
      role: "user",
    });
    return this.findByEmployeeId(params.employeeId)!;
  }
}
