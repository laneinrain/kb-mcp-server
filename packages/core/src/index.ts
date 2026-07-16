export {
  getChunkConfig,
  getContextConfig,
  getSettingsStore,
  initSettingsStore,
  type SettingsStore,
} from "./registry/settings-store.js";
export { runRegistryMigrations } from "./registry/migrations.js";
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
export { RerankClient } from "./rerank/rerank-client.js";
export { RerankError } from "./rerank/errors.js";
export type { RerankOptions, RerankResult } from "./rerank/types.js";
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
  computeContentHash,
  deriveDocumentIdForUserFile,
  normalizeParsedText,
} from "./ingestion/content-hash.js";
export {
  IngestionService,
  type IngestOptions,
  type IngestOutcome,
  type IngestResult,
} from "./ingestion/ingestion-service.js";
export { SearchService } from "./search/search-service.js";
export type { SearchOptions, SearchResult } from "./search/types.js";
export {
  ContextService,
  truncateAroundCenter,
  truncateFromEnd,
} from "./context/context-service.js";
export { ContextError, contextError } from "./context/errors.js";
export type { ContextErrorCode } from "./context/errors.js";
export type {
  ContextChunk,
  ReadAroundOptions,
  ReadAroundResult,
  ReadFileOptions,
  ReadFileResult,
} from "./context/types.js";
