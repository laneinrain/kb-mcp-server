import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ContextError,
  type ContextService,
  type SearchService,
} from "@kb/core";
import { z } from "zod";

export const SEARCH_TOOL_NAME = "search_knowledge";
export const READ_AROUND_TOOL_NAME = "read_around";
export const READ_FILE_TOOL_NAME = "read_file";

const searchInputSchema = {
  query: z.string().min(1).max(2000),
  top_k: z.number().int().min(1).max(10).optional(),
  collection: z.string().optional(),
};

const readAroundInputSchema = {
  document_id: z.string().min(1),
  chunk_index: z.number().int().min(0),
  window: z.number().int().min(0).max(10).optional(),
  collection: z.string().optional(),
};

const readFileInputSchema = {
  document_id: z.string().min(1),
  collection: z.string().optional(),
};

function toolErrorMessage(error: unknown): string {
  if (error instanceof ContextError || error instanceof Error) {
    return error.message;
  }
  return "Request failed";
}

export function buildMcpServer(
  searchService: SearchService,
  contextService: ContextService,
): McpServer {
  const server = new McpServer({ name: "kb-mcp-server", version: "0.1.0" });

  server.registerTool(
    SEARCH_TOOL_NAME,
    {
      description:
        "Semantic search over ingested documents. Returns ranked snippets with scores and source metadata.",
      inputSchema: searchInputSchema,
    },
    async ({ query, top_k, collection }) => {
      try {
        const results = await searchService.search(query, {
          topK: top_k,
          collection,
        });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ results }, null, 2) },
          ],
          structuredContent: { results },
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: toolErrorMessage(error) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    READ_AROUND_TOOL_NAME,
    {
      description:
        'Expand neighboring chunks around a document position. Example: after search_knowledge returns documentId "abc" and chunkIndex 3, call with document_id="abc", chunk_index=3.',
      inputSchema: readAroundInputSchema,
    },
    async ({ document_id, chunk_index, window, collection }) => {
      try {
        const result = await contextService.readAround(document_id, chunk_index, {
          window,
          collection,
        });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: toolErrorMessage(error) }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    READ_FILE_TOOL_NAME,
    {
      description:
        "Read bounded full-document content in chunk order by document ID.",
      inputSchema: readFileInputSchema,
    },
    async ({ document_id, collection }) => {
      try {
        const result = await contextService.readFile(document_id, { collection });
        return {
          content: [
            { type: "text" as const, text: JSON.stringify(result, null, 2) },
          ],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: toolErrorMessage(error) }],
          isError: true,
        };
      }
    },
  );

  return server;
}
