import { config as loadDotenv } from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV !== "production") {
  loadDotenv();
}

const envSchema = z.object({
  CHERRYIN_API_KEY: z.string().min(1),
  CHERRYIN_BASE_URL: z
    .string()
    .url()
    .default("https://open.cherryin.cc"),
  CHROMA_HOST: z.string().default("localhost"),
  CHROMA_PORT: z.coerce.number().default(8000),
  CHUNK_SIZE: z.coerce.number().default(1024),
  CHUNK_OVERLAP: z.coerce.number().default(154),
  SQLITE_PATH: z.string().default("./data/sqlite/registry.db"),
  DATA_DIR: z.string().default("./data"),
  BACKEND_HOST: z.string().default("127.0.0.1"),
  BACKEND_PORT: z.coerce.number().default(3000),
  DEFAULT_COLLECTION: z.string().default("default"),
  EMBEDDING_MODEL: z.string().default("qwen/qwen3-embedding-8b"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1024),
});

export type AppConfig = z.infer<typeof envSchema>;

const SECRET_KEYS = new Set(["CHERRYIN_API_KEY", "API_KEY"]);

function formatConfigError(error: z.ZodError): void {
  console.error("Invalid environment configuration:");
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    const label = SECRET_KEYS.has(field) ? field : field;
    console.error(`  ${label}: ${issue.message}`);
  }
}

export function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    formatConfigError(result.error);
    process.exit(1);
  }
  return result.data;
}
