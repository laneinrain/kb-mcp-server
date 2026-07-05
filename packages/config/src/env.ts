import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";

function findEnvFile(): string | undefined {
  const searchRoots = new Set<string>([process.cwd()]);

  // Cursor MCP may spawn with cwd outside the repo; walk up from this module too.
  let moduleDir = path.dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 8; depth++) {
    searchRoots.add(moduleDir);
    const parent = path.dirname(moduleDir);
    if (parent === moduleDir) {
      break;
    }
    moduleDir = parent;
  }

  for (const root of searchRoots) {
    let dir = root;
    for (let depth = 0; depth < 8; depth++) {
      const candidate = path.join(dir, ".env");
      if (existsSync(candidate)) {
        return candidate;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }

  return undefined;
}

/** Walk upward for pnpm-workspace.yaml so data paths are stable across package cwds. */
export function findMonorepoRoot(...startDirs: string[]): string {
  const seen = new Set<string>();
  for (const start of startDirs) {
    if (!start) {
      continue;
    }
    let dir = path.resolve(start);
    for (let depth = 0; depth < 12; depth++) {
      if (seen.has(dir)) {
        break;
      }
      seen.add(dir);
      if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
        return dir;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }
  return path.resolve(process.cwd());
}

function resolveRepoRelativePath(relativePath: string): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  const roots = [
    process.env.INIT_CWD,
    process.cwd(),
    path.dirname(fileURLToPath(import.meta.url)),
  ].filter((value): value is string => Boolean(value));
  return path.resolve(findMonorepoRoot(...roots), relativePath);
}

if (process.env.NODE_ENV !== "production") {
  const envPath = findEnvFile();
  loadDotenv(envPath ? { path: envPath, quiet: true } : { quiet: true });
}

const envSchema = z.object({
  CHERRYIN_API_KEY: z.string().min(1),
  CHERRYIN_BASE_URL: z
    .string()
    .url()
    .default("https://open.cherryin.cc")
    .transform((url) => {
      const trimmed = url.replace(/\/+$/, "");
      return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
    }),
  CHROMA_HOST: z.string().default("localhost"),
  CHROMA_PORT: z.coerce.number().default(8000),
  CHUNK_SIZE: z.coerce.number().default(1024),
  CHUNK_OVERLAP: z.coerce.number().default(154),
  SQLITE_PATH: z.string().default("./data/sqlite/registry.db"),
  DATA_DIR: z.string().default("./data"),
  BACKEND_HOST: z.string().default("127.0.0.1"),
  BACKEND_PORT: z.coerce.number().default(3000),
  MCP_HTTP_HOST: z.string().default("127.0.0.1"),
  MCP_HTTP_PORT: z.coerce.number().default(3100),
  DEFAULT_COLLECTION: z.string().default("default"),
  EMBEDDING_MODEL: z.string().default("qwen/qwen3-embedding-8b"),
  EMBEDDING_DIMENSIONS: z.coerce.number().default(1024),
  AUTH_ENABLED: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => {
      if (val === undefined || val === "") return false;
      if (typeof val === "boolean") return val;
      return val === "true" || val === "1";
    })
    .default(false),
  API_KEY: z.string().min(1).optional(),
}).superRefine((data, ctx) => {
  if (data.AUTH_ENABLED && !data.API_KEY) {
    ctx.addIssue({
      code: "custom",
      path: ["API_KEY"],
      message: "API_KEY is required when AUTH_ENABLED is true",
    });
  }
}).transform((data) => ({
  ...data,
  DATA_DIR: resolveRepoRelativePath(data.DATA_DIR),
  SQLITE_PATH: resolveRepoRelativePath(data.SQLITE_PATH),
}));

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
