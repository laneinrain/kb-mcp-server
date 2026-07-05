import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SYSTEM_EMPLOYEE_ID } from "./constants.js";
import { openAuthDatabase, UserStore } from "./user-store.js";

describe("ensureSystemUser", () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Windows may keep SQLite handles briefly
      }
    }
  });

  it("returns the same id on repeated calls", () => {
    tempDir = mkdtempSync(join(tmpdir(), "kb-auth-system-"));
    const db = openAuthDatabase(join(tempDir, "auth.db"));
    const store = new UserStore(db);

    const first = store.ensureSystemUser();
    const second = store.ensureSystemUser();

    expect(first.id).toBe(second.id);
    expect(first.employeeId).toBe(SYSTEM_EMPLOYEE_ID);
    expect(first.authSource).toBe("system");

    db.close();
  });
});

describe("MockCasAuthProvider system login block", () => {
  it("is covered in mock-cas-auth-provider.test.ts via SYSTEM_EMPLOYEE_ID", () => {
    expect(SYSTEM_EMPLOYEE_ID).toBe("00000000");
  });
});
