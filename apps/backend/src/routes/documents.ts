import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { basename, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import type {
  ChromaVectorStore,
  DocumentRecord,
  DocumentRegistry,
  IngestionService,
} from "@kb/core";
import { mapIngestError, notFound } from "../lib/errors.js";

const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".pdf",
]);

export interface DocumentsDeps {
  ingestionService: IngestionService;
  registry: DocumentRegistry;
  vectorStore: ChromaVectorStore;
  uploadsDir: string;
  defaultCollection: string;
}

function toPublicDocument(doc: DocumentRecord) {
  const { sourcePath: _sourcePath, ...rest } = doc;
  return rest;
}

function isAllowedUpload(filename: string, mimetype: string): boolean {
  const ext = extname(filename).toLowerCase();
  return ALLOWED_MIME.has(mimetype) && ALLOWED_EXTENSIONS.has(ext);
}

export async function registerDocumentRoutes(
  app: FastifyInstance,
  deps: DocumentsDeps,
): Promise<void> {
  app.post("/api/v1/documents", async (request, reply) => {
    let collection: string | undefined;
    let tempPath: string | undefined;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === "field" && part.fieldname === "collection") {
        collection = String(part.value);
      } else if (part.type === "file") {
        if (!isAllowedUpload(part.filename, part.mimetype)) {
          return reply.code(415).send({
            error: "unsupported_media_type",
            message: `Unsupported: ${part.mimetype}`,
          });
        }

        tempPath = join(
          deps.uploadsDir,
          `${randomUUID()}-${basename(part.filename)}`,
        );
        await pipeline(part.file, createWriteStream(tempPath));
      }
    }

    if (!tempPath) {
      return reply.code(400).send({
        error: "bad_request",
        message: "Missing file field",
      });
    }

    try {
      const result = await deps.ingestionService.ingest(tempPath, {
        collection: collection ?? deps.defaultCollection,
      });
      await unlink(tempPath).catch(() => {});
      return reply.code(201).send({
        documentId: result.documentId,
        chunkCount: result.chunkCount,
        collection: result.collection,
        status: "indexed",
      });
    } catch (error) {
      const mapped = mapIngestError(error);
      return reply.code(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/v1/documents", async () => {
    return deps.registry.listDocuments().map(toPublicDocument);
  });

  app.get("/api/v1/documents/:documentId", async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const doc = deps.registry.getDocument(documentId);

    if (!doc) {
      const mapped = notFound(documentId);
      return reply.code(mapped.statusCode).send(mapped.body);
    }

    return toPublicDocument(doc);
  });

  app.delete("/api/v1/documents/:documentId", async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const doc = deps.registry.getDocument(documentId);

    if (!doc) {
      const mapped = notFound(documentId);
      return reply.code(mapped.statusCode).send(mapped.body);
    }

    await deps.vectorStore.deleteByDocumentId(documentId, doc.collection);
    deps.registry.deleteDocument(documentId);

    return {
      status: "deleted",
      documentId,
    };
  });
}
