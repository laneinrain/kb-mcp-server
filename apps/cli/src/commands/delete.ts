import { createApiClient, ApiError } from "../api-client.js";

export async function runDelete(documentId: string): Promise<number> {
  if (!documentId.trim()) {
    process.stderr.write("documentId is required\n");
    return 1;
  }

  try {
    const client = createApiClient();
    const result = await client.deleteDocument(documentId);
    console.log(JSON.stringify(result));
    return 0;
  } catch (error) {
    if (error instanceof ApiError) {
      process.stderr.write(`${error.message}\n`);
      if (error.status === 404 || error.body.error === "not_found") {
        return 1;
      }
      return 2;
    }
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 2;
  }
}
