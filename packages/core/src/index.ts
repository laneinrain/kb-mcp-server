export {
  getChunkConfig,
  getContextConfig,
  getSettingsStore,
  initSettingsStore,
  type SettingsStore,
} from "./registry/settings-store.js";
export {
  getDocumentRegistry,
  type DocumentRegistry,
} from "./registry/document-registry.js";
export type {
  ChunkConfig,
  ContextConfig,
  DocumentRecord,
  DocumentStatus,
  RegisterDocumentInput,
} from "./registry/types.js";
export { EmbeddingClient } from "./embeddings/embedding-client.js";
export {
  ChromaVectorStore,
  buildChunkId,
  type UpsertChunksParams,
  type QueryParams,
  type QueryHit,
  type GetByIdsParams,
  type ChunkHit,
} from "./vector-store/chroma-store.js";
export { chunkText } from "./ingestion/chunker.js";
export type { TextChunk } from "./ingestion/types.js";
export {
  parseDocument,
  parseTxt,
  parseMd,
  parsePdf,
  INSUFFICIENT_TEXT_ERROR,
  type ParsedDocument,
} from "./ingestion/parsers/index.js";
export {
  IngestionService,
  type IngestOptions,
  type IngestResult,
} from "./ingestion/ingestion-service.js";
export { SearchService } from "./search/search-service.js";
export type { SearchOptions, SearchResult } from "./search/types.js";
