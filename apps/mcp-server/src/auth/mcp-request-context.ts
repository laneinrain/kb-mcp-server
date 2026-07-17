import { AsyncLocalStorage } from "node:async_hooks";
import type { McpCallerContext } from "./types.js";

export const mcpCallerStorage = new AsyncLocalStorage<McpCallerContext>();

export function getMcpCallerContext(): McpCallerContext {
  const ctx = mcpCallerStorage.getStore();
  if (!ctx) {
    throw new Error("MCP caller context not available");
  }
  return ctx;
}

export function runWithMcpCallerContext<T>(
  ctx: McpCallerContext,
  fn: () => T,
): T {
  return mcpCallerStorage.run(ctx, fn);
}

export function enterMcpCallerContext(ctx: McpCallerContext): void {
  mcpCallerStorage.enterWith(ctx);
}

/** ACL set for tool handlers; undefined = no filter (service/global/missing store). */
export function getToolAllowedDocumentIds(): ReadonlySet<string> | undefined {
  const ctx = mcpCallerStorage.getStore();
  if (!ctx || ctx.authMode !== "user") {
    return undefined;
  }
  return ctx.allowedDocumentIds;
}
