import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ADMIN_DEFAULT_PASSWORD,
  ADMIN_EMPLOYEE_ID,
  SYSTEM_EMPLOYEE_ID,
} from "./constants.js";
import { AuthConflictError, AuthValidationError } from "./errors.js";
import { hashPassword, verifyPassword } from "./password.js";
import { openAuthDatabase, UserStore } from "./user-store.js";

describe("UserStore", () => {
  let tempDir: string;
  let store: UserStore;
  let db: ReturnType<typeof openAuthDatabase>;

  afterEach(() => {
    db?.close();
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore cleanup races
      }
    }
  });

  function createStore(): UserStore {
    tempDir = mkdtempSync(join(tmpdir(), "kb-user-store-test-"));
    db = openAuthDatabase(join(tempDir, "auth.db"));
    store = new UserStore(db);
    return store;
  }

  it("ensureAdminUser creates admin with role=admin once", async () => {
    const store = createStore();
    const hash = await hashPassword(ADMIN_DEFAULT_PASSWORD);

    const admin = store.ensureAdminUser(hash);
    expect(admin.employeeId).toBe(ADMIN_EMPLOYEE_ID);
    expect(admin.role).toBe("admin");
    expect(admin.authSource).toBe("local");

    const again = store.ensureAdminUser(hash);
    expect(again.id).toBe(admin.id);
  });

  it("registerLocalUser stores bcrypt hash and role=user", async () => {
    const store = createStore();
    const hash = await hashPassword("password123");

    const user = store.registerLocalUser({
      employeeId: "12345",
      passwordHash: hash,
    });

    expect(user.employeeId).toBe("12345");
    expect(user.role).toBe("user");
    expect(user.authSource).toBe("local");

    const row = store.findRowByEmployeeId("12345");
    expect(row?.password_hash).toBe(hash);
    expect(await verifyPassword("password123", hash)).toBe(true);
  });

  it("registerLocalUser rejects reserved employee ids", async () => {
    const store = createStore();
    const hash = await hashPassword("password123");

    expect(() =>
      store.registerLocalUser({
        employeeId: ADMIN_EMPLOYEE_ID,
        passwordHash: hash,
      }),
    ).toThrow(AuthValidationError);

    expect(() =>
      store.registerLocalUser({
        employeeId: SYSTEM_EMPLOYEE_ID,
        passwordHash: hash,
      }),
    ).toThrow(AuthValidationError);
  });

  it("registerLocalUser rejects duplicate employee id", async () => {
    const store = createStore();
    const hash = await hashPassword("password123");

    store.registerLocalUser({ employeeId: "12345", passwordHash: hash });
    expect(() =>
      store.registerLocalUser({ employeeId: "12345", passwordHash: hash }),
    ).toThrow(AuthConflictError);
  });
});
