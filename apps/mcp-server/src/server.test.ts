import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { SearchService } from "@kb/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildMcpServer, SEARCH_TOOL_NAME } from "./server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverSource = readFileSync(join(__dirname, "server.ts"), "utf8");

const FORBIDDEN_TOOL_NAMES = [
  "upload",
  "delete",
  "index",
  "ingest",
  "add_document",
  "remove_document",
];

function mockSearchService(
  searchImpl?: SearchService["search"],
): SearchService {
  return {
    search: vi.fn(searchImpl ?? (async () => [])),
  } as unknown as SearchService;
}

async function connectTestClient(searchService: SearchService) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = buildMcpServer(searchService);
  await server.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);

  return { client, server, searchService };
}

describe("buildMcpServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("registers only search_knowledge", async () => {
    const searchService = mockSearchService();
    const { client, server } = await connectTestClient(searchService);

    const { tools } = await client.listTools();
    expect(tools).toHaveLength(1);
    expect(tools?.[0]?.name).toBe(SEARCH_TOOL_NAME);

    await client.close();
    await server.close();
  });

  it("search_knowledge delegates to SearchService.search with mapped topK", async () => {
    const search = vi.fn().mockResolvedValue([
      {
        score: 0.9,
        text: "snippet",
        documentId: "d1",
        filename: "a.txt",
        chunkIndex: 0,
      },
    ]);
    const searchService = mockSearchService(search);
    const { client, server } = await connectTestClient(searchService);

    await client.callTool({
      name: SEARCH_TOOL_NAME,
      arguments: { query: "test query", top_k: 3, collection: "default" },
    });

    expect(search).toHaveBeenCalledWith("test query", {
      topK: 3,
      collection: "default",
    });

    await client.close();
    await server.close();
  });

  it("returns structuredContent.results with required fields", async () => {
    const result = {
      score: 0.9,
      text: "snippet",
      documentId: "d1",
      filename: "a.txt",
      chunkIndex: 0,
    };
    const searchService = mockSearchService(async () => [result]);
    const { client, server } = await connectTestClient(searchService);

    const response = await client.callTool({
      name: SEARCH_TOOL_NAME,
      arguments: { query: "hello" },
    });

    expect(response.structuredContent).toEqual({ results: [result] });
    const content = response.content as { type: string; text: string }[] | undefined;
    expect(content?.[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("d1"),
    });

    await client.close();
    await server.close();
  });

  it("rejects empty query with tool error", async () => {
    const searchService = mockSearchService();
    const { client, server } = await connectTestClient(searchService);

    const response = await client.callTool({
      name: SEARCH_TOOL_NAME,
      arguments: { query: "" },
    });

    expect(response.isError).toBe(true);
    expect(searchService.search).not.toHaveBeenCalled();

    await client.close();
    await server.close();
  });

  it("does not register ingest or write tools (MCP-05)", () => {
    for (const name of FORBIDDEN_TOOL_NAMES) {
      expect(serverSource).not.toMatch(
        new RegExp(`registerTool\\(\\s*["']${name}`, "i"),
      );
    }
  });

  it("does not import ChromaVectorStore or EmbeddingClient in server.ts", () => {
    expect(serverSource).not.toMatch(/ChromaVectorStore/);
    expect(serverSource).not.toMatch(/EmbeddingClient/);
    expect(serverSource).not.toMatch(/embedQuery/);
  });
});
