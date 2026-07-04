import { afterEach, describe, expect, it } from "vitest";
import { shouldServeWeb } from "./static.js";

describe("shouldServeWeb", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("returns false in default dev mode", () => {
    delete process.env.NODE_ENV;
    delete process.env.SERVE_WEB;
    expect(shouldServeWeb()).toBe(false);
  });

  it("returns true when NODE_ENV is production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SERVE_WEB;
    expect(shouldServeWeb()).toBe(true);
  });

  it("returns true when SERVE_WEB is true", () => {
    delete process.env.NODE_ENV;
    process.env.SERVE_WEB = "true";
    expect(shouldServeWeb()).toBe(true);
  });
});
