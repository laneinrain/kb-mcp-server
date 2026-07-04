import type { DocumentRecord } from "@kb/core";
import { createApiClient, ApiError } from "../api-client.js";

function truncate(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max - 1)}…`;
}

function formatUpdatedAt(iso: string): string {
  try {
    return iso.slice(0, 19).replace("T", " ");
  } catch {
    return iso;
  }
}

export function formatDocumentTable(documents: DocumentRecord[]): string {
  if (documents.length === 0) {
    return "(no documents indexed)";
  }

  const headers = [
    "id",
    "filename",
    "status",
    "chunks",
    "collection",
    "updatedAt",
  ] as const;

  const rows = documents.map((doc) => [
    truncate(doc.id, 12),
    truncate(doc.filename, 24),
    doc.status,
    String(doc.chunkCount),
    truncate(doc.collection, 12),
    formatUpdatedAt(doc.updatedAt),
  ]);

  const widths = headers.map((header, index) =>
    Math.max(
      header.length,
      ...rows.map((row) => row[index]!.length),
    ),
  );

  const formatRow = (cells: string[]) =>
    cells.map((cell, i) => cell.padEnd(widths[i]!)).join("  ");

  return [formatRow([...headers]), formatRow(widths.map((w) => "-".repeat(w))), ...rows.map(formatRow)].join(
    "\n",
  );
}

export async function runList(): Promise<number> {
  try {
    const client = createApiClient();
    const documents = await client.listDocuments();
    console.log(formatDocumentTable(documents));
    return 0;
  } catch (error) {
    if (error instanceof ApiError) {
      process.stderr.write(`${error.message}\n`);
      return 2;
    }
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 2;
  }
}
