import { createWriteStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import type { FastifyInstance } from "fastify";
import type {
  ChromaVectorStore,
  DocumentRecord,
  DocumentRegistry,
  IngestionService,
} from "@kb/core";
import { notFound } from "../lib/errors.js";
import type { ApiRouteOpts } from "../auth.js";
import {
  ingestMultipartUpload,
  isAllowedUpload,
  toPublicDocument,
} from "./document-upload.js";

export interface DocumentsDeps {
  ingestionService: IngestionService;
  registry: DocumentRegistry;
  vectorStore: ChromaVectorStore;
  uploadsDir: string;
  defaultCollection: string;
  systemUserId: string | null;
  routeOpts?: ApiRouteOpts;
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

    return ingestMultipartUpload(request, reply, {
      ingestionService: deps.ingestionService,
      uploadsDir: deps.uploadsDir,
      defaultCollection: deps.defaultCollection,
      userId,
    });
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

// Re-export for tests that reference upload helpers
export { isAllowedUpload, toPublicDocument };
