import Fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { createAppServices } from "./services.js";
import { createProtectedRouteOpts, createAdminRouteOpts, registerBearerAuthIfEnabled } from "./auth.js";
import { registerWebStatic } from "./static.js";
import "./types.js";

async function main(): Promise<void> {
  const services = await createAppServices();
  const { config, vectorStore, embeddingClient } = services;

  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "kb-mcp-server API",
        version: "0.1.0",
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
  });

  await app.register(fastifyMultipart, {
    limits: {
      files: 1,
      fileSize: 50 * 1024 * 1024,
    },
  });

  await registerHealthRoutes(app, { vectorStore, embeddingClient });
  await registerAuthRoutes(app, {
    authProvider: services.authProvider,
    casMock: config.CAS_MOCK,
  });
  await registerBearerAuthIfEnabled(app, config);
  const routeOpts = createProtectedRouteOpts(config, app, services.authProvider);
  if (config.USER_AUTH_ENABLED) {
    const adminRouteOpts = createAdminRouteOpts(
      config,
      app,
      services.authProvider,
    );
    await registerAdminRoutes(app, {
      authProvider: services.authProvider,
      authSqlitePath: config.AUTH_SQLITE_PATH,
      registry: services.registry,
      ingestionService: services.ingestionService,
      vectorStore: services.vectorStore,
      uploadsDir: services.uploadsDir,
      defaultCollection: services.config.DEFAULT_COLLECTION,
      routeOpts: adminRouteOpts,
    });
  }
  await registerDocumentRoutes(app, {
    ingestionService: services.ingestionService,
    registry: services.registry,
    vectorStore: services.vectorStore,
    uploadsDir: services.uploadsDir,
    defaultCollection: services.config.DEFAULT_COLLECTION,
    systemUserId: services.systemUserId,
    routeOpts,
  });
  await registerSearchRoutes(app, {
    searchService: services.searchService,
    registry: services.registry,
    systemUserId: services.systemUserId,
    routeOpts,
  });
  await registerSettingsRoutes(app, {
    settingsStore: services.settingsStore,
    routeOpts,
  });

  await registerWebStatic(app);

  app.setErrorHandler((error, _request, reply) => {
    const err = error as Error & { validation?: unknown; statusCode?: number };

    if (err.validation) {
      reply.code(400);
      return {
        error: "validation_error",
        message: err.message,
      };
    }

    reply.code(err.statusCode ?? 500);
    return {
      error: "internal_error",
      message: err.message,
    };
  });

  await app.listen({
    host: config.BACKEND_HOST,
    port: config.BACKEND_PORT,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
