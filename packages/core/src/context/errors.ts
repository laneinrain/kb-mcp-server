export type ContextErrorCode =
  | "document_not_found"
  | "chunk_index_out_of_range"
  | "chunks_missing";

export class ContextError extends Error {
  constructor(
    public readonly code: ContextErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ContextError";
  }
}

export function contextError(
  code: ContextErrorCode,
  message: string,
): ContextError {
  return new ContextError(code, message);
}
