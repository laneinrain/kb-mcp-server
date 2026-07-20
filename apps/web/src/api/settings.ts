import { apiRequest } from "./client.js";

export interface ContextSettings {
  readAroundWindowDefault: number;
  readAroundWindowMax: number;
  readAroundMaxChars: number;
  readFileMaxChunks: number;
  readFileMaxChars: number;
}

export interface ModelSettings {
  embeddingModel: string;
  rerankEnabled: boolean;
  rerankModel: string;
  rerankCandidates: number;
}

export interface SettingsResponse {
  chunk: { chunkSize: number; chunkOverlap: number };
  context: ContextSettings;
  models: ModelSettings;
  embeddingDimensions: number;
}

export async function fetchSettings(): Promise<SettingsResponse> {
  return apiRequest<SettingsResponse>("/api/v1/settings");
}

export async function updateContextSettings(
  patch: ContextSettings,
): Promise<{ context: ContextSettings }> {
  return apiRequest<{ context: ContextSettings }>("/api/v1/settings/context", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

export async function updateModelSettings(
  patch: ModelSettings,
): Promise<{ models: ModelSettings }> {
  return apiRequest<{ models: ModelSettings }>("/api/v1/settings/models", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}
