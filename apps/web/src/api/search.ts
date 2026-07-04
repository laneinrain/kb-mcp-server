import type { SearchResultItem } from "../types.js";
import { apiRequest } from "./client.js";

export async function searchDocuments(
  query: string,
  topK: number,
): Promise<SearchResultItem[]> {
  const body = await apiRequest<{ results: SearchResultItem[] }>(
    "/api/v1/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, topK }),
    },
  );
  return body.results;
}
