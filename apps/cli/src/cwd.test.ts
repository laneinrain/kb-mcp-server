import { afterEach, describe, expect, it } from "vitest";
import { restoreInvokerCwd } from "./cwd.js";

describe("restoreInvokerCwd", () => {
  const originalCwd = process.cwd();
  const env = process.env;

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = { ...env };
  });

  it("chdirs to INIT_CWD when set", () => {
    process.env.INIT_CWD = originalCwd;
    process.chdir(process.env.TEMP ?? originalCwd);
    restoreInvokerCwd();
    expect(process.cwd()).toBe(originalCwd);
  });
});
