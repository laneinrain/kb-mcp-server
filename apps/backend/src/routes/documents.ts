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
import type { ApiRouteOpts } from "../auth.js";

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
  systemUserId: string | null;
  routeOpts?: ApiRouteOpts;
}

function toPublicDocument(doc: DocumentRecord) {
  const { sourcePath: _sourcePath, ...rest } = doc;
  return rest;
}

function isAllowedUpload(filename: string, mimetype: string): boolean {
  const ext = extname(filename).toLowerCase();
  return ALLOWED_MIME.has(mimetype) && ALLOWED_EXTENSIONS.has(ext);
}

function canReadDocument(
  doc: DocumentRecord,
  userId: string,
  systemUserId: string,
): boolean {
  return doc.userId === userId || doc.userId === systemUserId;
}

function resolveIngestUserId(
  request: { authMode?: "user" | "service"; authUser?: { id: string } },
  systemUserId: string | null,
): string {
  if (request.authMode === "user" && request.authUser) {
    return request.authUser.id;
  }
  if (request.authMode === "service" && systemUserId) {
    // CLI bulk ingest via global API_KEY assigns legacy system ownership.
    return systemUserId;
  }
  throw new Error("Authenticated user required for ingestion");
}

export async function registerDocumentRoutes(
  app: FastifyInstance,
  deps: DocumentsDeps,
): Promise<void> {
  const opts = deps.routeOpts ?? {};
  const systemUserId = deps.systemUserId;

  app.post("/api/v1/documents", opts, async (request, reply) => {
    let collection: string | undefined;
    let tempPath: string | undefined;
    let originalFilename: string | undefined;

    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === "field" && part.fieldname === "collection") {
        collection = String(part.value);
      } else if (part.type === "file") {
        originalFilename = basename(part.filename);
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

    let userId = "";
    if (systemUserId) {
      try {
        userId = resolveIngestUserId(request, systemUserId);
      } catch {
        return reply.code(401).send({
          error: "unauthorized",
          message: "Authenticated user required",
        });
      }
    }

    try {
      const result = await deps.ingestionService.ingest(tempPath, {
        collection: collection ?? deps.defaultCollection,
        filename: originalFilename,
        userId,
      });
      await unlink(tempPath).catch(() => {});
      const statusCode = result.outcome === "created" ? 201 : 200;
      return reply.code(statusCode).send({
        documentId: result.documentId,
        chunkCount: result.chunkCount,
        collection: result.collection,
        status: "indexed",
        outcome: result.outcome,
      });
    } catch (error) {
      const mapped = mapIngestError(error);
      return reply.code(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/v1/documents", opts, async (request) => {
    if (request.authMode === "user" && request.authUser && systemUserId) {
      return deps.registry
        .listDocumentsForUser(request.authUser.id, systemUserId)
        .map(toPublicDocument);
    }

    return deps.registry.listDocuments().map(toPublicDocument);
  });

  app.get("/api/v1/documents/:documentId", opts, async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const doc = deps.registry.getDocument(documentId);

    if (!doc) {
      const mapped = notFound(documentId);
      return reply.code(mapped.statusCode).send(mapped.body);
    }

    if (
      request.authMode === "user" &&
      request.authUser &&
      systemUserId &&
      !canReadDocument(doc, request.authUser.id, systemUserId)
    ) {
      const mapped = notFound(documentId);
      return reply.code(mapped.statusCode).send(mapped.body);
    }

    return toPublicDocument(doc);
  });

  app.delete("/api/v1/documents/:documentId", opts, async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const doc = deps.registry.getDocument(documentId);

    if (!doc) {
      const mapped = notFound(documentId);
      return reply.code(mapped.statusCode).send(mapped.body);
    }

    if (request.authMode === "user" && request.authUser) {
      if (doc.userId !== request.authUser.id) {
        const mapped = notFound(documentId);
        return reply.code(mapped.statusCode).send(mapped.body);
      }
    }

    await deps.vectorStore.deleteByDocumentId(documentId, doc.collection);
    deps.registry.deleteDocument(documentId);

    return {
      status: "deleted",
      documentId,
    };
  });
}
