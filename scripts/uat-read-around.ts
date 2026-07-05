/**
 * UAT: search_knowledge → read_around on live stdio MCP server.
 * Prerequisites: ingested corpus, `pnpm --filter @kb/mcp-server build`
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const QUERY = process.env.UAT_QUERY ?? "sample";

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["apps/mcp-server/dist/stdio.js"],
    cwd: process.cwd(),
  });
  const client = new Client({ name: "uat-read-around", version: "1.0.0" });

  const timeout = setTimeout(() => {
    console.error("TIMEOUT after 30s");
    process.exit(1);
  }, 30_000);

  try {
    await client.connect(transport);

    const searchResult = await client.callTool({
      name: "search_knowledge",
      arguments: { query: QUERY },
    });

    if (searchResult.isError) {
      console.error("FAIL: search_knowledge error", searchResult.content);
      process.exit(1);
    }

    const structured = searchResult.structuredContent as
      | { results?: Array<{ documentId?: string; chunkIndex?: number }> }
      | undefined;
    const hit = structured?.results?.[0];
    if (!hit?.documentId || hit.chunkIndex === undefined) {
      console.error(
        "FAIL: no search hit with documentId/chunkIndex — ingest a document first",
      );
      process.exit(1);
    }

    const readResult = await client.callTool({
      name: "read_around",
      arguments: {
        document_id: hit.documentId,
        chunk_index: hit.chunkIndex,
      },
    });

    if (readResult.isError) {
      console.error("FAIL: read_around error", readResult.content);
      process.exit(1);
    }

    const readPayload = readResult.structuredContent as
      | { chunks?: Array<{ filename?: string; chunkIndex?: number; text?: string }> }
      | undefined;
    const chunks = readPayload?.chunks ?? [];
    if (chunks.length < 1) {
      console.error("FAIL: read_around returned no chunks");
      process.exit(1);
    }

    const first = chunks[0]!;
    if (first.filename === undefined || first.chunkIndex === undefined) {
      console.error("FAIL: chunk missing filename or chunkIndex metadata");
      process.exit(1);
    }

    console.log(
      JSON.stringify(
        {
          status: "PASS",
          query: QUERY,
          hit: { documentId: hit.documentId, chunkIndex: hit.chunkIndex },
          readAround: {
            chunkCount: chunks.length,
            firstChunk: {
              filename: first.filename,
              chunkIndex: first.chunkIndex,
              textLength: first.text?.length ?? 0,
            },
          },
        },
        null,
        2,
      ),
    );
  } finally {
    clearTimeout(timeout);
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
