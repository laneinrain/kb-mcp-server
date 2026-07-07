import type { DocumentRecord } from "../types.js";
import type { UploadResult } from "./documents.js";
import { apiRequest } from "./client.js";

export interface AdminUser {
  id: string;
  employeeId: string;
  authSource: "cas" | "local" | "system";
  role: "admin" | "user";
  createdAt: string;
  documentCount: number;
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  return apiRequest<AdminUser[]>("/api/v1/admin/users");
}

export async function listAdminUserDocuments(
  userId: string,
): Promise<DocumentRecord[]> {
  return apiRequest<DocumentRecord[]>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/documents`,
  );
}

export async function deleteAdminDocument(
  documentId: string,
): Promise<{ status: string; documentId: string }> {
  return apiRequest(`/api/v1/admin/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });
}

export async function uploadAdminUserDocument(
  userId: string,
  file: File,
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<UploadResult>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}/documents`,
    {
      method: "POST",
      body: form,
    },
  );
}
