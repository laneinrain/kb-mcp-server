import { TokenTextSplitter } from "@langchain/textsplitters";
import type { ChunkConfig } from "../registry/types.js";
import { getChunkConfig } from "../registry/settings-store.js";

export async function chunkText(
  text: string,
  config?: ChunkConfig,
): Promise<string[]> {
  const { chunkSize, chunkOverlap } = config ?? getChunkConfig();
  const splitter = new TokenTextSplitter({
    encodingName: "cl100k_base",
    chunkSize,
    chunkOverlap,
  });

  return splitter.splitText(text);
}
