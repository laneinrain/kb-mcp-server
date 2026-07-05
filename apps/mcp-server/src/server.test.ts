import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  ContextError,
  type ContextService,
  type ReadAroundResult,
  type ReadFileResult,
  type SearchService,
} from "@kb/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMcpServer,
  READ_AROUND_TOOL_NAME,
  READ_FILE_TOOL_NAME,
  SEARCH_TOOL_NAME,
} from "./server.js";

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

function mockContextService(
  overrides?: Partial<{
    readAround: ContextService["readAround"];
    readFile: ContextService["readFile"];
  }>,
): ContextService {
  return {
    readAround: vi.fn(
      overrides?.readAround ??
        (async () =>
          ({
            documentId: "d1",
            filename: "a.txt",
            collection: "default",
            chunkRange: { start: 0, end: 0 },
            windowRequested: 1,
            windowApplied: 1,
            totalChars: 10,
            chunks: [
              {
                documentId: "d1",
                filename: "a.txt",
                chunkIndex: 0,
                text: "full chunk",
                isCenter: true,
              },
            ],
          }) satisfies ReadAroundResult),
    ),
    readFile: vi.fn(
      overrides?.readFile ??
        (async () =>
          ({
            documentId: "d1",
            filename: "a.txt",
            collection: "default",
            chunkCount: 1,
            returnedChunks: 1,
            chunks: [
              {
                documentId: "d1",
                filename: "a.txt",
                chunkIndex: 0,
                text: "full chunk",
              },
            ],
          }) satisfies ReadFileResult),
    ),
  } as unknown as ContextService;
}

async function connectTestClient(
  searchService: SearchService,
  contextService: ContextService,
) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = buildMcpServer(searchService, contextService);
  await server.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);

  return { client, server, searchService, contextService };
}

describe("buildMcpServer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it("registers search_knowledge, read_around, and read_file", async () => {
    const searchService = mockSearchService();
    const contextService = mockContextService();
    const { client, server } = await connectTestClient(
      searchService,
      contextService,
    );

    const { tools } = await client.listTools();
    expect(tools).toHaveLength(3);
    expect(tools?.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        SEARCH_TOOL_NAME,
        READ_AROUND_TOOL_NAME,
        READ_FILE_TOOL_NAME,
      ]),
    );

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
    const contextService = mockContextService();
    const { client, server } = await connectTestClient(
      searchService,
      contextService,
    );

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
    const contextService = mockContextService();
    const { client, server } = await connectTestClient(
      searchService,
      contextService,
    );

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

  it("read_around delegates to ContextService.readAround with mapped args", async () => {
    const readAround = vi.fn().mockResolvedValue({
      documentId: "d1",
      filename: "a.txt",
      collection: "default",
      chunkRange: { start: 0, end: 2 },
      windowRequested: 1,
      windowApplied: 1,
      chunks: [],
    });
    const searchService = mockSearchService();
    const contextService = mockContextService({ readAround });
    const { client, server } = await connectTestClient(
      searchService,
      contextService,
    );

    await client.callTool({
      name: READ_AROUND_TOOL_NAME,
      arguments: {
        document_id: "d1",
        chunk_index: 1,
        window: 2,
        collection: "default",
      },
    });

    expect(readAround).toHaveBeenCalledWith("d1", 1, {
      window: 2,
      collection: "default",
    });

    await client.close();
    await server.close();
  });

  it("read_around returns structuredContent with chunks", async () => {
    const readAroundResult: ReadAroundResult = {
      documentId: "d1",
      filename: "a.txt",
      collection: "default",
      chunkRange: { start: 0, end: 0 },
      windowRequested: 1,
      windowApplied: 1,
      totalChars: 11,
      chunks: [
        {
          documentId: "d1",
          filename: "a.txt",
          chunkIndex: 0,
          text: "full chunk",
          isCenter: true,
        },
      ],
    };
    const searchService = mockSearchService();
    const contextService = mockContextService({
      readAround: async () => readAroundResult,
    });
    const { client, server } = await connectTestClient(
      searchService,
      contextService,
    );

    const response = await client.callTool({
      name: READ_AROUND_TOOL_NAME,
      arguments: { document_id: "d1", chunk_index: 0 },
    });

    expect(response.structuredContent).toEqual(readAroundResult);
    expect(response.isError).toBeUndefined();

    await client.close();
    await server.close();
  });

  it("read_around returns isError on ContextError without partial chunks", async () => {
    const searchService = mockSearchService();
    const contextService = mockContextService({
      readAround: async () => {
        throw new ContextError("document_not_found", "Document d9 not found");
      },
    });
    const { client, server } = await connectTestClient(
      searchService,
      contextService,
    );

    const response = await client.callTool({
      name: READ_AROUND_TOOL_NAME,
      arguments: { document_id: "d9", chunk_index: 0 },
    });

    expect(response.isError).toBe(true);
    expect(response.structuredContent).toBeUndefined();
    const content = response.content as { type: string; text: string }[] | undefined;
    expect(content?.[0]?.text).toContain("not found");

    await client.close();
    await server.close();
  });

  it("read_file delegates to ContextService.readFile", async () => {
    const readFile = vi.fn().mockResolvedValue({
      documentId: "d1",
      filename: "a.txt",
      collection: "default",
      chunkCount: 1,
      returnedChunks: 1,
      chunks: [],
    });
    const searchService = mockSearchService();
    const contextService = mockContextService({ readFile });
    const { client, server } = await connectTestClient(
      searchService,
      contextService,
    );

    await client.callTool({
      name: READ_FILE_TOOL_NAME,
      arguments: { document_id: "d1", collection: "default" },
    });

    expect(readFile).toHaveBeenCalledWith("d1", { collection: "default" });

    await client.close();
    await server.close();
  });

  it("rejects empty query with tool error", async () => {
    const searchService = mockSearchService();
    const contextService = mockContextService();
    const { client, server } = await connectTestClient(
      searchService,
      contextService,
    );

    const response = await client.callTool({
      name: SEARCH_TOOL_NAME,
      arguments: { query: "" },
    });

    expect(response.isError).toBe(true);
    expect(searchService.search).not.toHaveBeenCalled();

    await client.close();
    await server.close();
  });

  it("read_around description includes search hit example", () => {
    expect(serverSource).toMatch(/documentId.*chunkIndex|chunkIndex.*documentId/);
    expect(serverSource).toMatch(/document_id=/);
    expect(serverSource).toMatch(/chunk_index=/);
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
