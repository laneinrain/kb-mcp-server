import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import { describe, expect, it, vi } from "vitest";
import type { IngestOutcome } from "@kb/core";
import { registerDocumentRoutes } from "./documents.js";

async function buildApp(
  outcome: IngestOutcome,
  statusCode?: number,
) {
  const ingestionService = {
    ingest: vi.fn().mockResolvedValue({
      documentId: "doc-dedup",
      chunkCount: outcome === "unchanged" ? 4 : 2,
      collection: "default",
      outcome,
    }),
  };

  const app = Fastify();
  await app.register(fastifyMultipart);
  await registerDocumentRoutes(app, {
    ingestionService: ingestionService as never,
    registry: {
      listDocuments: vi.fn().mockReturnValue([]),
      getDocument: vi.fn(),
      deleteDocument: vi.fn(),
    } as never,
    vectorStore: {
      deleteByDocumentId: vi.fn(),
    } as never,
    uploadsDir: "./data/uploads",
    defaultCollection: "default",
    systemUserId: null,
  });

  return { app, ingestionService, expectedStatus: statusCode };
}

function multipartPayload(filename = "sample.txt", content = "hello") {
  const boundary = "----dedup-test";
  return {
    headers: {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload:
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--\r\n`,
  };
}

describe("POST /api/v1/documents dedup outcomes", () => {
  it.each([
    ["created", 201],
    ["unchanged", 200],
    ["replaced", 200],
  ] as const)("returns %s with HTTP %i", async (outcome, expectedStatus) => {
    const { app } = await buildApp(outcome);
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/documents",
      ...multipartPayload(),
    });

    expect(response.statusCode).toBe(expectedStatus);
    expect(response.json()).toMatchObject({
      documentId: "doc-dedup",
      collection: "default",
      status: "indexed",
      outcome,
    });
  });
});
