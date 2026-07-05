import { readdir, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import { loadConfig, type AppConfig } from "@kb/config";
import {
  ChromaVectorStore,
  EmbeddingClient,
  getDocumentRegistry,
  IngestionService,
  initSettingsStore,
} from "@kb/core";
import {
  createApiClient,
  type ApiClient,
  ApiError,
} from "../api-client.js";

export const ALLOWED_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".pdf",
]);

export async function* walkFiles(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkFiles(full);
    } else if (ALLOWED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
      yield full;
    }
  }
}

export interface IngestDeps {
  config: AppConfig;
  apiClient: ApiClient;
  ingestDirect: (filePath: string, collection?: string) => Promise<{
    documentId: string;
    chunkCount: number;
    collection: string;
  }>;
}

export function createDefaultIngestDeps(config?: AppConfig): IngestDeps {
  const resolved = config ?? loadConfig();
  return {
    config: resolved,
    apiClient: createApiClient(resolved),
    ingestDirect: async (filePath, collection) => {
      const settingsStore = initSettingsStore(resolved);
      const registry = getDocumentRegistry(settingsStore.db);
      const vectorStore = new ChromaVectorStore(resolved);
      const embeddingClient = new EmbeddingClient(resolved);
      const ingestionService = IngestionService.create(resolved, {
        registry,
        vectorStore,
        embeddingClient,
        settingsStore,
      });
      return ingestionService.ingest(filePath, { collection, userId: "" });
    },
  };
}

export async function ingestSingleFile(
  filePath: string,
  collection: string | undefined,
  deps: IngestDeps,
  log: (line: string) => void = (line) => process.stderr.write(`${line}\n`),
): Promise<{ ok: true } | { ok: false; exitCode: 1 | 2; message: string }> {
  log(`ingesting ${filePath} …`);

  try {
    if (deps.config.AUTH_ENABLED) {
      const result = await deps.apiClient.uploadDocument(filePath, collection);
      log(
        `  ok ${JSON.stringify({
          documentId: result.documentId,
          chunkCount: result.chunkCount,
          collection: result.collection,
          status: result.status,
        })}`,
      );
    } else {
      const result = await deps.ingestDirect(filePath, collection);
      log(
        `  ok ${JSON.stringify({
          documentId: result.documentId,
          chunkCount: result.chunkCount,
          collection: result.collection,
        })}`,
      );
    }
    return { ok: true };
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    log(`  fail: ${message}`);
    const exitCode: 1 | 2 =
      error instanceof ApiError && error.body.error === "not_found" ? 1 : 2;
    return { ok: false, exitCode, message };
  }
}

export async function runIngest(
  targetPath: string,
  collection: string | undefined,
  deps: IngestDeps = createDefaultIngestDeps(),
): Promise<number> {
  if (deps.config.USER_AUTH_ENABLED && !deps.config.AUTH_ENABLED) {
    process.stderr.write(
      "USER_AUTH_ENABLED requires AUTH_ENABLED=true and API_KEY for CLI REST ingest.\n",
    );
    return 2;
  }

  let stats;
  try {
    stats = await stat(targetPath);
  } catch {
    process.stderr.write(`Path not found: ${targetPath}\n`);
    return 1;
  }

  const files: string[] = [];
  if (stats.isDirectory()) {
    for await (const file of walkFiles(targetPath)) {
      files.push(file);
    }
    if (files.length === 0) {
      process.stderr.write(`No supported files found under ${targetPath}\n`);
      return 1;
    }
  } else if (stats.isFile()) {
    const ext = extname(targetPath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      process.stderr.write(`Unsupported file type: ${ext}\n`);
      return 1;
    }
    files.push(targetPath);
  } else {
    process.stderr.write(`Not a file or directory: ${targetPath}\n`);
    return 1;
  }

  let success = 0;
  let failed = 0;
  let worstExit: 1 | 2 = 1;

  for (const file of files) {
    const result = await ingestSingleFile(file, collection, deps);
    if (result.ok) {
      success += 1;
    } else {
      failed += 1;
      worstExit = result.exitCode === 2 ? 2 : worstExit;
    }
  }

  if (files.length > 1) {
    process.stderr.write(
      `ingest complete: ${success} succeeded, ${failed} failed\n`,
    );
  }

  if (failed > 0) {
    return worstExit;
  }
  return 0;
}
