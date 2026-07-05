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
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { createAppServices } from "./services.js";
import { apiRouteOpts, registerBearerAuthIfEnabled } from "./auth.js";
import { registerWebStatic } from "./static.js";

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
  await registerBearerAuthIfEnabled(app, config);
  const routeOpts = apiRouteOpts(config, app);
  await registerDocumentRoutes(app, {
    ingestionService: services.ingestionService,
    registry: services.registry,
    vectorStore: services.vectorStore,
    uploadsDir: services.uploadsDir,
    defaultCollection: services.config.DEFAULT_COLLECTION,
    routeOpts,
  });
  await registerSearchRoutes(app, {
    searchService: services.searchService,
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
