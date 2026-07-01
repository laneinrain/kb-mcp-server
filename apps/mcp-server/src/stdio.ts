import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./server.js";
import { createMcpServices } from "./services.js";
import { logError, logInfo } from "./logger.js";

// Cursor MCP config example:
// { "command": "pnpm", "args": ["--filter", "@kb/mcp-server", "dev:stdio"] }
// Or after build: { "command": "node", "args": ["path/to/apps/mcp-server/dist/stdio.js"] }

async function main(): Promise<void> {
  const { searchService } = await createMcpServices();
  const server = buildMcpServer(searchService);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logInfo("kb-mcp-server running on stdio");
}

main().catch((err) => {
  logError(err);
  process.exit(1);
});
