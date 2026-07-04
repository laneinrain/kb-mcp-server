import type { DocumentRecord } from "../types.js";
import { apiRequest } from "./client.js";

export interface UploadResult {
  documentId: string;
  chunkCount: number;
  collection: string;
  status: string;
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  return apiRequest<DocumentRecord[]>("/api/v1/documents");
}

export async function deleteDocument(
  documentId: string,
): Promise<{ status: string; documentId: string }> {
  return apiRequest(`/api/v1/documents/${documentId}`, { method: "DELETE" });
}

export async function uploadFile(file: File): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<UploadResult>("/api/v1/documents", {
    method: "POST",
    body: form,
  });
}
