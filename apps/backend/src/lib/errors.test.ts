import { describe, expect, it, vi } from "vitest";
import { INSUFFICIENT_TEXT_ERROR } from "@kb/core";
import { mapIngestError, notFound } from "./errors.js";

describe("mapIngestError", () => {
  it("maps INSUFFICIENT_TEXT_ERROR to 422", () => {
    const mapped = mapIngestError(new Error(INSUFFICIENT_TEXT_ERROR));

    expect(mapped.statusCode).toBe(422);
    expect(mapped.body.error).toBe("unprocessable_entity");
  });

  it("maps unsupported extension to 415", () => {
    const mapped = mapIngestError(
      new Error("Unsupported file extension: .docx"),
    );

    expect(mapped.statusCode).toBe(415);
    expect(mapped.body.error).toBe("unsupported_media_type");
  });
});

describe("notFound", () => {
  it("returns 404 with not_found error", () => {
    const mapped = notFound("abc-123");

    expect(mapped.statusCode).toBe(404);
    expect(mapped.body.message).toContain("abc-123");
  });
});
