import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { loadConfig, type AppConfig } from "@kb/config";
import type { DocumentRecord } from "@kb/core";

export interface ApiErrorBody {
  error: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody,
  ) {
    super(body.message);
    this.name = "ApiError";
  }
}

export interface UploadResult {
  documentId: string;
  chunkCount: number;
  collection: string;
  status: string;
}

export interface DeleteResult {
  status: string;
  documentId: string;
}

export interface SearchResultItem {
  score: number;
  text: string;
  documentId: string;
  filename: string;
  chunkIndex: number;
}

export interface ApiClient {
  listDocuments(): Promise<DocumentRecord[]>;
  deleteDocument(documentId: string): Promise<DeleteResult>;
  uploadDocument(
    filePath: string,
    collection?: string,
  ): Promise<UploadResult>;
  search(body: {
    query: string;
    topK?: number;
    collection?: string;
  }): Promise<{ results: SearchResultItem[] }>;
}

function baseUrl(config: AppConfig): string {
  return `http://${config.BACKEND_HOST}:${config.BACKEND_PORT}`;
}

function authHeaders(config: AppConfig): Record<string, string> {
  if (config.AUTH_ENABLED && config.API_KEY) {
    return { Authorization: `Bearer ${config.API_KEY}` };
  }
  return {};
}

async function parseErrorResponse(
  response: Response,
): Promise<ApiErrorBody> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error && body.message) {
      return body;
    }
  } catch {
    // fall through
  }
  return {
    error: "http_error",
    message: `HTTP ${response.status} ${response.statusText}`,
  };
}

export function createApiClient(config?: AppConfig): ApiClient {
  const resolved = config ?? loadConfig();
  const url = baseUrl(resolved);
  const headers = authHeaders(resolved);

  return {
    async listDocuments(): Promise<DocumentRecord[]> {
      const response = await fetch(`${url}/api/v1/documents`, { headers });
      if (!response.ok) {
        throw new ApiError(response.status, await parseErrorResponse(response));
      }
      return (await response.json()) as DocumentRecord[];
    },

    async deleteDocument(documentId: string): Promise<DeleteResult> {
      const response = await fetch(`${url}/api/v1/documents/${documentId}`, {
        method: "DELETE",
        headers,
      });
      if (!response.ok) {
        throw new ApiError(response.status, await parseErrorResponse(response));
      }
      return (await response.json()) as DeleteResult;
    },

    async uploadDocument(
      filePath: string,
      collection?: string,
    ): Promise<UploadResult> {
      const buffer = readFileSync(filePath);
      const filename = basename(filePath);
      const form = new FormData();
      form.append(
        "file",
        new Blob([buffer]),
        filename,
      );
      if (collection) {
        form.append("collection", collection);
      }

      const response = await fetch(`${url}/api/v1/documents`, {
        method: "POST",
        headers,
        body: form,
      });
      if (!response.ok) {
        throw new ApiError(response.status, await parseErrorResponse(response));
      }
      return (await response.json()) as UploadResult;
    },

    async search(body: {
      query: string;
      topK?: number;
      collection?: string;
    }): Promise<{ results: SearchResultItem[] }> {
      const response = await fetch(`${url}/api/v1/search`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new ApiError(response.status, await parseErrorResponse(response));
      }
      return (await response.json()) as { results: SearchResultItem[] };
    },
  };
}
