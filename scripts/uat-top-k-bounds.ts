import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function callSearch(top_k?: number): Promise<{ count: number; isError?: boolean }> {
  const transport = new StdioClientTransport({
    command: "C:/Program Files/nodejs/node.exe",
    args: ["apps/mcp-server/dist/stdio.js"],
    cwd: process.cwd(),
  });
  const client = new Client({ name: "topk-test", version: "1.0.0" });
  await client.connect(transport);
  const args: { query: string; top_k?: number } = { query: "sample" };
  if (top_k !== undefined) args.top_k = top_k;
  const result = await client.callTool({ name: "search_knowledge", arguments: args });
  await client.close();
  if (result.isError) {
    return { count: 0, isError: true };
  }
  const structured = result.structuredContent as { results?: unknown[] };
  return { count: structured.results?.length ?? 0 };
}

async function main(): Promise<void> {
  const d = await callSearch();
  const t10 = await callSearch(10);
  const t11 = await callSearch(11);
  console.log(`default: ${d.count} results (expect <=5)`);
  console.log(`top_k=10: ${t10.count} results (expect <=10)`);
  console.log(`top_k=11: isError=${t11.isError} (expect true or count<=10)`);
  const ok =
    d.count <= 5 &&
    t10.count <= 10 &&
    (t11.isError === true || t11.count <= 10);
  if (!ok) process.exit(1);
  console.log("TOP_K BOUNDS OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
