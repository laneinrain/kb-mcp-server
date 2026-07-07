import type { FastifyInstance } from "fastify";
import type { AuthProvider } from "@kb/auth";
import { openAuthDatabase, UserStore } from "@kb/auth";
import type {
  ChromaVectorStore,
  DocumentRegistry,
  IngestionService,
} from "@kb/core";
import { notFound } from "../lib/errors.js";
import type { ApiRouteOpts } from "../auth.js";
import { ingestMultipartUpload, toPublicDocument } from "./document-upload.js";

export interface AdminRoutesDeps {
  authProvider: AuthProvider | null;
  authSqlitePath: string;
  registry: DocumentRegistry;
  ingestionService: IngestionService;
  vectorStore: ChromaVectorStore;
  uploadsDir: string;
  defaultCollection: string;
  routeOpts?: ApiRouteOpts;
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  deps: AdminRoutesDeps,
): Promise<void> {
  const opts = deps.routeOpts ?? {};

  app.get("/api/v1/admin/users", opts, async (_request, reply) => {
    const db = openAuthDatabase(deps.authSqlitePath);
    try {
      const users = new UserStore(db).listAllUsers();
      return users.map((user) => ({
        id: user.id,
        employeeId: user.employeeId,
        authSource: user.authSource,
        role: user.role,
        createdAt: user.createdAt,
        documentCount: deps.registry.countDocumentsByUserId(user.id),
      }));
    } finally {
      db.close();
    }
  });

  app.get("/api/v1/admin/users/:userId/documents", opts, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const user = await deps.authProvider?.getUserById(userId);
    if (!user) {
      const mapped = notFound(userId);
      return reply.code(mapped.statusCode).send({
        error: "not_found",
        message: "User not found",
      });
    }

    return deps.registry
      .listDocumentsByUserId(userId)
      .map(toPublicDocument);
  });

  app.get("/api/v1/admin/documents/:documentId", opts, async (request, reply) => {
    const { documentId } = request.params as { documentId: string };
    const doc = deps.registry.getDocument(documentId);

    if (!doc) {
      const mapped = notFound(documentId);
      return reply.code(mapped.statusCode).send(mapped.body);
    }

    return toPublicDocument(doc);
  });

  app.delete("/api/v1/admin/documents/:documentId", opts, async (request, reply) => {
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

  app.post(
    "/api/v1/admin/users/:userId/documents",
    opts,
    async (request, reply) => {
      const { userId } = request.params as { userId: string };
      const user = await deps.authProvider?.getUserById(userId);
      if (!user) {
        return reply.code(404).send({
          error: "not_found",
          message: "User not found",
        });
      }

      return ingestMultipartUpload(request, reply, {
        ingestionService: deps.ingestionService,
        uploadsDir: deps.uploadsDir,
        defaultCollection: deps.defaultCollection,
        userId,
      });
    },
  );
}
