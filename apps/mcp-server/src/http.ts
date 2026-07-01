import { randomUUID } from "node:crypto";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { AppConfig } from "@kb/config";
import type { McpServices } from "./services.js";
import { createMcpServices } from "./services.js";
import { buildMcpServer } from "./server.js";
import { logError, logInfo } from "./logger.js";

export async function createMcpHttpApp(
  services?: McpServices,
): Promise<express.Application> {
  const resolved = services ?? (await createMcpServices());
  const { searchService } = resolved;
  const transports: Record<string, StreamableHTTPServerTransport> = {};

  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;
      let transport: StreamableHTTPServerTransport | undefined;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports[id] = transport!;
          },
        });
        transport.onclose = () => {
          const sid = transport?.sessionId;
          if (sid) {
            delete transports[sid];
          }
        };
        const server = buildMcpServer(searchService);
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logError(error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  return app;
}

export async function startMcpHttpServer(): Promise<void> {
  const services = await createMcpServices();
  const app = await createMcpHttpApp(services);
  const { config } = services;

  app.listen(config.MCP_HTTP_PORT, config.MCP_HTTP_HOST, () => {
    logInfo(
      `MCP HTTP listening on http://${config.MCP_HTTP_HOST}:${config.MCP_HTTP_PORT}/mcp`,
    );
  });
}

async function main(): Promise<void> {
  await startMcpHttpServer();
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("http.ts") ||
    process.argv[1].endsWith("http.js"));

if (isMain) {
  main().catch((err) => {
    logError(err);
    process.exit(1);
  });
}

export type { AppConfig };
