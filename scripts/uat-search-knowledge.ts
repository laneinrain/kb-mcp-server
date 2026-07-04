import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "C:/Program Files/nodejs/node.exe",
    args: ["apps/mcp-server/dist/stdio.js"],
    cwd: process.cwd(),
  });
  const client = new Client({ name: "uat-search", version: "1.0.0" });

  const timeout = setTimeout(() => {
    console.error("TIMEOUT after 30s");
    process.exit(1);
  }, 30_000);

  await client.connect(transport);
  const result = await client.callTool({
    name: "search_knowledge",
    arguments: { query: "sample" },
  });
  clearTimeout(timeout);
  console.log(JSON.stringify(result, null, 2));
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
