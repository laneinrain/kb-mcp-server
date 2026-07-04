import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = "http://127.0.0.1:3100/mcp";
const REST_URL = "http://127.0.0.1:3000/api/v1/search";
const QUERY = "sample";

async function restSearch(): Promise<
  { documentId: string; score: number; filename: string }[]
> {
  const res = await fetch(REST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY }),
  });
  if (!res.ok) {
    throw new Error(`REST search failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    results: { documentId: string; score: number; filename: string }[];
  };
  return data.results;
}

async function mcpSearch(): Promise<
  { documentId: string; score: number; filename: string }[]
> {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({ name: "parity-test", version: "1.0.0" });
  await client.connect(transport);
  const result = await client.callTool({
    name: "search_knowledge",
    arguments: { query: QUERY },
  });
  await client.close();
  const structured = result.structuredContent as {
    results: { documentId: string; score: number; filename: string }[];
  };
  return structured.results;
}

async function main(): Promise<void> {
  const [rest, mcp] = await Promise.all([restSearch(), mcpSearch()]);
  console.log("REST top:", rest[0]);
  console.log("MCP  top:", mcp[0]);
  const sameTopId = rest[0]?.documentId === mcp[0]?.documentId;
  const scoreDelta = Math.abs((rest[0]?.score ?? 0) - (mcp[0]?.score ?? 0));
  console.log("same top documentId:", sameTopId);
  console.log("score delta:", scoreDelta.toFixed(4));
  if (!sameTopId || scoreDelta > 0.05) {
    process.exit(1);
  }
  console.log("PARITY OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
