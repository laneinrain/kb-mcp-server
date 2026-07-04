import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["apps/mcp-server/dist/stdio.js"],
    cwd: process.cwd(),
    env: { DOTENV_CONFIG_QUIET: "true" },
  });

  const client = new Client({ name: "stdio-test", version: "1.0.0" });

  await client.connect(transport);
  const { tools } = await client.listTools();
  console.log("connected, tools:", tools?.map((t) => t.name));
  await client.close();
  console.log("OK");
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});
