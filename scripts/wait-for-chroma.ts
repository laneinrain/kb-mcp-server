import { loadConfig } from "@kb/config";
import { ChromaClient } from "chromadb";

const POLL_INTERVAL_MS = 500;
const TIMEOUT_MS = 60_000;

async function waitForChroma(): Promise<void> {
  const config = loadConfig();
  const client = new ChromaClient({
    host: config.CHROMA_HOST,
    port: config.CHROMA_PORT,
  });

  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      await client.heartbeat();
      console.error("Chroma ready");
      process.exit(0);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  console.error(
    `Chroma not ready after ${TIMEOUT_MS / 1000}s (${config.CHROMA_HOST}:${config.CHROMA_PORT})`,
  );
  process.exit(1);
}

waitForChroma();
