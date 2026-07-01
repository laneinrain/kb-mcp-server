import { describe, expect, it } from "vitest";
import { loadConfig } from "./env.js";

describe("loadConfig", () => {
  it("returns typed config when required vars are set", () => {
    process.env.CHERRYIN_API_KEY = "test-key";
    const config = loadConfig();
    expect(config.CHUNK_SIZE).toBe(1024);
    expect(config.CHUNK_OVERLAP).toBe(154);
    expect(config.CHERRYIN_BASE_URL).toBe("https://open.cherryin.cc/v1");
  });
});
