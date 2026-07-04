import { describe, expect, it, vi } from "vitest";
import * as apiClientModule from "../api-client.js";
import type { ApiClient } from "../api-client.js";
import { runDelete } from "./delete.js";

describe("runDelete", () => {
  it("calls deleteDocument with document id", async () => {
    const deleteDocument = vi.fn().mockResolvedValue({
      status: "deleted",
      documentId: "abc-123",
    });
    vi.spyOn(apiClientModule, "createApiClient").mockReturnValue({
      deleteDocument,
    } as unknown as ApiClient);

    const code = await runDelete("abc-123");

    expect(code).toBe(0);
    expect(deleteDocument).toHaveBeenCalledWith("abc-123");
  });
});
