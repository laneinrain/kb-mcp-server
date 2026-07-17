import { describe, expect, it } from "vitest";
import {
  getToolAllowedDocumentIds,
  runWithMcpCallerContext,
} from "./mcp-request-context.js";

describe("getToolAllowedDocumentIds", () => {
  it("returns undefined when no ALS store", () => {
    expect(getToolAllowedDocumentIds()).toBeUndefined();
  });

  it("returns undefined for service and global", async () => {
    await runWithMcpCallerContext({ authMode: "service" }, () => {
      expect(getToolAllowedDocumentIds()).toBeUndefined();
    });
    await runWithMcpCallerContext({ authMode: "global" }, () => {
      expect(getToolAllowedDocumentIds()).toBeUndefined();
    });
  });

  it("returns allowedDocumentIds for user mode", async () => {
    const allowed = new Set(["a", "b"]);
    await runWithMcpCallerContext(
      { authMode: "user", allowedDocumentIds: allowed },
      () => {
        expect(getToolAllowedDocumentIds()).toBe(allowed);
      },
    );
  });

  it("returns empty Set for user with no documents", async () => {
    const empty = new Set<string>();
    await runWithMcpCallerContext(
      { authMode: "user", allowedDocumentIds: empty },
      () => {
        expect(getToolAllowedDocumentIds()).toBe(empty);
      },
    );
  });
});
