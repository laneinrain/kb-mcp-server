import type { AppConfig } from "@kb/config";
import type { ContextService, SearchService } from "@kb/core";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createMcpHttpApp } from "./http.js";

const mockConfig = {
  MCP_HTTP_HOST: "127.0.0.1",
  MCP_HTTP_PORT: 3100,
} as AppConfig;

function mockServices(search?: SearchService["search"]) {
  const searchService = {
    search: vi.fn(search ?? (async () => [])),
  } as unknown as SearchService;

  const contextService = {
    readAround: vi.fn(async () => ({
      documentId: "d1",
      filename: "a.txt",
      collection: "default",
      chunkRange: { start: 0, end: 0 },
      windowRequested: 1,
      windowApplied: 1,
      chunks: [
        {
          documentId: "d1",
          filename: "a.txt",
          chunkIndex: 0,
          text: "full chunk text",
          isCenter: true,
        },
      ],
    })),
    readFile: vi.fn(async () => ({
      documentId: "d1",
      filename: "a.txt",
      collection: "default",
      chunkCount: 1,
      returnedChunks: 1,
      chunks: [],
    })),
  } as unknown as ContextService;

  return {
    config: mockConfig,
    searchService,
    contextService,
  };
}

const initializeBody = {
  jsonrpc: "2.0" as const,
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  },
};

const MCP_ACCEPT = "application/json, text/event-stream";

async function initSession(app: Awaited<ReturnType<typeof createMcpHttpApp>>) {
  const init = await request(app)
    .post("/mcp")
    .set("Accept", MCP_ACCEPT)
    .send(initializeBody);
  const sessionId = init.headers["mcp-session-id"] as string;
  expect(sessionId).toBeDefined();

  await request(app)
    .post("/mcp")
    .set("Accept", MCP_ACCEPT)
    .set("mcp-session-id", sessionId)
    .send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

  return sessionId;
}

describe("MCP HTTP /mcp", () => {
  it("POST /mcp without session returns 400 for non-initialize body", async () => {
    const app = await createMcpHttpApp(mockServices());

    const response = await request(app)
      .post("/mcp")
      .set("Accept", MCP_ACCEPT)
      .send({ jsonrpc: "2.0", method: "tools/list", id: 2 });

    expect(response.status).toBe(400);
  });

  it("POST /mcp with initialize body returns 200 and session header", async () => {
    const app = await createMcpHttpApp(mockServices());

    const response = await request(app)
      .post("/mcp")
      .set("Accept", MCP_ACCEPT)
      .send(initializeBody);

    expect(response.status).toBe(200);
    expect(response.headers["mcp-session-id"]).toBeDefined();
  });

  it("GET /mcp without session returns 405", async () => {
    const app = await createMcpHttpApp(mockServices());

    const response = await request(app)
      .get("/mcp")
      .set("Accept", MCP_ACCEPT);

    expect(response.status).toBe(405);
  });

  it("GET /mcp with valid session opens SSE stream", async () => {
    const app = await createMcpHttpApp(mockServices());

    const init = await request(app)
      .post("/mcp")
      .set("Accept", MCP_ACCEPT)
      .send(initializeBody);
    const sessionId = init.headers["mcp-session-id"] as string;

    await new Promise<void>((resolve, reject) => {
      const req = request(app)
        .get("/mcp")
        .set("Accept", MCP_ACCEPT)
        .set("mcp-session-id", sessionId)
        .buffer(false)
        .parse((res, callback) => {
          expect(res.statusCode).toBe(200);
          expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
          (res as unknown as import("node:http").IncomingMessage).destroy();
          callback(null, null);
        });

      req.end((err) => {
        if (err && (err as NodeJS.ErrnoException).code !== "ECONNRESET") {
          reject(err);
          return;
        }
        resolve();
      });
    });
  });

  it("tools/list includes search_knowledge, read_around, and read_file", async () => {
    const app = await createMcpHttpApp(mockServices());
    const sessionId = await initSession(app);

    const list = await request(app)
      .post("/mcp")
      .set("Accept", MCP_ACCEPT)
      .set("mcp-session-id", sessionId)
      .send({ jsonrpc: "2.0", method: "tools/list", id: 2 });

    expect(list.status).toBe(200);
    const responseText =
      typeof list.text === "string" ? list.text : JSON.stringify(list.body);
    expect(responseText).toContain("search_knowledge");
    expect(responseText).toContain("read_around");
    expect(responseText).toContain("read_file");
  });

  it("tools/call read_around succeeds over HTTP session", async () => {
    const services = mockServices();
    const app = await createMcpHttpApp(services);
    const sessionId = await initSession(app);

    const call = await request(app)
      .post("/mcp")
      .set("Accept", MCP_ACCEPT)
      .set("mcp-session-id", sessionId)
      .send({
        jsonrpc: "2.0",
        method: "tools/call",
        id: 3,
        params: {
          name: "read_around",
          arguments: { document_id: "d1", chunk_index: 0 },
        },
      });

    expect(call.status).toBe(200);
    const responseText =
      typeof call.text === "string" ? call.text : JSON.stringify(call.body);
    expect(responseText).toContain("full chunk text");
    expect(services.contextService.readAround).toHaveBeenCalledWith("d1", 0, {
      window: undefined,
      collection: undefined,
    });
  });

  it("does not use legacy SSE-only transport as sole handler", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const httpSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "http.ts"),
      "utf8",
    );

    expect(httpSource).toMatch(/StreamableHTTPServerTransport/);
    expect(httpSource).not.toMatch(/SSEServerTransport/);
  });
});
