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

/** Dev-only JWT for mock CAS login; never used when NODE_ENV=production. */
const DEV_JWT_SECRET =
  "dev-only-jwt-secret-do-not-use-in-production-32";

function applyDevelopmentAuthDefaults(): void {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test") {
    return;
  }
  if (process.env.USER_AUTH_ENABLED === undefined || process.env.USER_AUTH_ENABLED === "") {
    process.env.USER_AUTH_ENABLED = "true";
  }
  const userAuthOff =
    process.env.USER_AUTH_ENABLED === "false" ||
    process.env.USER_AUTH_ENABLED === "0";
  if (!userAuthOff && !process.env.JWT_SECRET) {
    process.env.JWT_SECRET = DEV_JWT_SECRET;
  }
}

const booleanFromEnv = (val: boolean | string | undefined, defaultValue: boolean) => {
  if (val === undefined || val === "") return defaultValue;
  if (typeof val === "boolean") return val;
  return val === "true" || val === "1";
};

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
  READ_AROUND_WINDOW_DEFAULT: z.coerce.number().default(1),
  READ_AROUND_WINDOW_MAX: z.coerce.number().default(3),
  READ_AROUND_MAX_CHARS: z.coerce.number().default(32000),
  READ_FILE_MAX_CHUNKS: z.coerce.number().default(50),
  READ_FILE_MAX_CHARS: z.coerce.number().default(64000),
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
  USER_AUTH_ENABLED: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => booleanFromEnv(val, false))
    .default(false),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.coerce.number().default(604800),
  AUTH_SQLITE_PATH: z.string().default("./data/sqlite/auth.db"),
  AUTH_PROVIDER: z.enum(["cas", "local"]).default("cas"),
  CAS_MOCK: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => booleanFromEnv(val, true))
    .default(true),
  CAS_SERVER_URL: z.string().url().optional(),
}).superRefine((data, ctx) => {
  if (data.AUTH_ENABLED && !data.API_KEY) {
    ctx.addIssue({
      code: "custom",
      path: ["API_KEY"],
      message: "API_KEY is required when AUTH_ENABLED is true",
    });
  }
  if (data.USER_AUTH_ENABLED && !data.JWT_SECRET) {
    ctx.addIssue({
      code: "custom",
      path: ["JWT_SECRET"],
      message: "JWT_SECRET is required when USER_AUTH_ENABLED is true",
    });
  }
  if (data.USER_AUTH_ENABLED && !data.CAS_MOCK && !data.CAS_SERVER_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["CAS_SERVER_URL"],
      message: "CAS_SERVER_URL is required when USER_AUTH_ENABLED is true and CAS_MOCK is false",
    });
  }
}).transform((data) => ({
  ...data,
  DATA_DIR: resolveRepoRelativePath(data.DATA_DIR),
  SQLITE_PATH: resolveRepoRelativePath(data.SQLITE_PATH),
  AUTH_SQLITE_PATH: resolveRepoRelativePath(data.AUTH_SQLITE_PATH),
}));

export type AppConfig = z.infer<typeof envSchema>;

const SECRET_KEYS = new Set(["CHERRYIN_API_KEY", "API_KEY", "JWT_SECRET"]);

function formatConfigError(error: z.ZodError): void {
  console.error("Invalid environment configuration:");
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    const label = SECRET_KEYS.has(field) ? field : field;
    console.error(`  ${label}: ${issue.message}`);
  }
}

export function loadConfig(): AppConfig {
  applyDevelopmentAuthDefaults();
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    formatConfigError(result.error);
    process.exit(1);
  }
  return result.data;
}
