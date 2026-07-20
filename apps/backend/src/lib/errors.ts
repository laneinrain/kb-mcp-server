import { ContextError, INSUFFICIENT_TEXT_ERROR } from "@kb/core";

export interface ErrorBody {
  error: string;
  message: string;
}

export function mapIngestError(error: unknown): {
  statusCode: number;
  body: ErrorBody;
} {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Unsupported file extension")) {
    return {
      statusCode: 415,
      body: { error: "unsupported_media_type", message },
    };
  }
  if (message === INSUFFICIENT_TEXT_ERROR) {
    return {
      statusCode: 422,
      body: { error: "unprocessable_entity", message },
    };
  }
  if (message.includes("exceeds maximum size")) {
    return {
      statusCode: 413,
      body: { error: "payload_too_large", message },
    };
  }
  if (message.includes("Path must be under")) {
    return {
      statusCode: 400,
      body: { error: "bad_request", message },
    };
  }
  if (message.includes("Embedding API") || message.includes("ECONNREFUSED")) {
    return {
      statusCode: 503,
      body: { error: "service_unavailable", message },
    };
  }

  return {
    statusCode: 500,
    body: { error: "internal_error", message },
  };
}

export function notFound(documentId: string): {
  statusCode: number;
  body: ErrorBody;
} {
  return {
    statusCode: 404,
    body: {
      error: "not_found",
      message: `Document ${documentId} not found`,
    },
  };
}

export function mapSearchError(error: unknown): {
  statusCode: number;
  body: ErrorBody;
} {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("Embedding API") || message.includes("ECONNREFUSED")) {
    return {
      statusCode: 503,
      body: { error: "service_unavailable", message },
    };
  }

  return {
    statusCode: 500,
    body: { error: "internal_error", message },
  };
}

export function mapContextError(error: unknown): {
  statusCode: number;
  body: ErrorBody;
} {
  if (error instanceof ContextError) {
    if (error.code === "document_not_found") {
      return {
        statusCode: 404,
        body: { error: "not_found", message: error.message },
      };
    }
    if (error.code === "chunk_index_out_of_range") {
      return {
        statusCode: 400,
        body: { error: "bad_request", message: error.message },
      };
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return {
    statusCode: 500,
    body: { error: "internal_error", message },
  };
}

export function mapContextSettingsError(error: unknown): {
  statusCode: number;
  body: ErrorBody;
} {
  const message = error instanceof Error ? error.message : String(error);

  if (
    message.includes("must be >=") ||
    message.includes("rerankCandidates") ||
    message.includes("embeddingModel") ||
    message.includes("rerankModel")
  ) {
    return {
      statusCode: 400,
      body: { error: "validation_error", message },
    };
  }

  return {
    statusCode: 500,
    body: { error: "internal_error", message },
  };
}
