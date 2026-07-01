import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SearchService } from "@kb/core";
import { z } from "zod";

export const SEARCH_TOOL_NAME = "search_knowledge";

const searchInputSchema = {
  query: z.string().min(1).max(2000),
  top_k: z.number().int().min(1).max(10).optional(),
  collection: z.string().optional(),
};

export function buildMcpServer(searchService: SearchService): McpServer {
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
        const message =
          error instanceof Error ? error.message : "Search failed";
        return {
          content: [{ type: "text" as const, text: message }],
          isError: true,
        };
      }
    },
  );

  return server;
}
