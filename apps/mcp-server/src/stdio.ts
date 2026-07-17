import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { McpAuthError } from "./auth/mcp-auth-resolver.js";
import { enterMcpCallerContext } from "./auth/mcp-request-context.js";
import type { McpCallerContext } from "./auth/types.js";
import { buildMcpServer } from "./server.js";
import { createMcpServices } from "./services.js";
import { logError, logInfo } from "./logger.js";

// Cursor MCP config example (stdio + user token when USER_AUTH_ENABLED=true):
// {
//   "command": "pnpm",
//   "args": ["--filter", "@kb/mcp-server", "dev:stdio"],
//   "env": { "MCP_USER_TOKEN": "<jwt>", "DOTENV_CONFIG_QUIET": "true" }
// }

export async function resolveStdioCallerContext(
  userAuthEnabled: boolean,
  resolve: (token: string | undefined) => Promise<McpCallerContext>,
  token: string | undefined = process.env.MCP_USER_TOKEN,
): Promise<McpCallerContext> {
  if (!userAuthEnabled) {
    return { authMode: "global" };
  }
  return resolve(token);
}

async function main(): Promise<void> {
  const services = await createMcpServices();
  let callerContext: McpCallerContext;

  try {
    const mcpAuthActive =
      services.config.USER_AUTH_ENABLED && services.config.MCP_AUTH_REQUIRED;
    callerContext = await resolveStdioCallerContext(
      mcpAuthActive,
      (token) => services.authResolver.resolve(token),
    );
  } catch (error) {
    if (error instanceof McpAuthError) {
      logError(error);
      process.exit(1);
    }
    throw error;
  }

  enterMcpCallerContext(callerContext);

  const { searchService, contextService } = services;
  const server = buildMcpServer(searchService, contextService);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logInfo("kb-mcp-server running on stdio");
}

const isMain = process.argv.some(
  (arg) =>
    arg.endsWith("stdio.ts") ||
    arg.endsWith("stdio.js") ||
    arg.replace(/\\/g, "/").endsWith("/stdio.ts") ||
    arg.replace(/\\/g, "/").endsWith("/stdio.js"),
);

if (isMain) {
  main().catch((err) => {
    logError(err);
    process.exit(1);
  });
}
