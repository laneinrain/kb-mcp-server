import { loadConfig } from "@kb/config";
import {
  ChromaVectorStore,
  EmbeddingClient,
  getDocumentRegistry,
  IngestionService,
  initSettingsStore,
} from "@kb/core";

function printUsage(): void {
  console.error("Usage: pnpm ingest <file-path> [--collection name]");
}

function parseArgs(argv: string[]): {
  filePath?: string;
  collection?: string;
} {
  const args = [...argv];
  let collection: string | undefined;
  const positional: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--collection") {
      collection = args[index + 1];
      index += 1;
      continue;
    }
    positional.push(arg);
  }

  return {
    filePath: positional[0],
    collection,
  };
}

async function main(): Promise<void> {
  const { filePath, collection } = parseArgs(process.argv.slice(2));

  if (!filePath) {
    printUsage();
    process.exit(1);
  }

  const config = loadConfig();
  const settingsStore = initSettingsStore(config);
  const registry = getDocumentRegistry(settingsStore.db);
  const vectorStore = new ChromaVectorStore(config);
  const embeddingClient = new EmbeddingClient(config);
  const ingestionService = IngestionService.create(config, {
    registry,
    vectorStore,
    embeddingClient,
    settingsStore,
  });

  try {
    const result = await ingestionService.ingest(filePath, { collection });
    console.log(
      JSON.stringify({
        documentId: result.documentId,
        chunkCount: result.chunkCount,
        collection: result.collection,
      }),
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

main();
