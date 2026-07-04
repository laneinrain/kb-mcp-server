# Phase 4: Admin Surfaces & Security - Pattern Map

**Mapped:** 2026-07-04
**Files analyzed:** 28 new/modified files
**Analogs found:** 18 / 28

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/config/src/env.ts` | config | transform | `packages/config/src/env.ts` | exact |
| `packages/config/src/env.test.ts` | test | — | `packages/config/src/env.test.ts` | exact |
| `.env.example` | config | — | `.env.example` | exact |
| `apps/backend/src/auth.ts` | middleware | request-response | `apps/backend/src/index.ts` (plugin registration) | role-match |
| `apps/backend/src/index.ts` | config | request-response | `apps/backend/src/index.ts` + `04-RESEARCH.md` static pattern | exact |
| `apps/backend/src/routes/documents.ts` (auth preHandler) | route | CRUD + file-I/O | `apps/backend/src/routes/documents.ts` + `search.ts` (route opts) | exact |
| `apps/backend/src/routes/search.ts` (auth preHandler) | route | request-response | `apps/backend/src/routes/search.ts` | exact |
| `apps/backend/src/auth.test.ts` | test | request-response | `apps/backend/src/routes/documents.test.ts` | role-match |
| `apps/backend/package.json` | config | — | `apps/backend/package.json` + `apps/mcp-server/package.json` | exact |
| `apps/cli/package.json` | config | — | `apps/mcp-server/package.json` | exact |
| `apps/cli/tsconfig.json` | config | — | `apps/mcp-server/tsconfig.json` | exact |
| `apps/cli/src/index.ts` | config | request-response | `apps/mcp-server/src/stdio.ts` + `scripts/ingest.ts` | exact |
| `apps/cli/src/api-client.ts` | utility | request-response | `apps/backend/src/routes/documents.ts` + `search.ts` (contracts) | partial |
| `apps/cli/src/commands/ingest.ts` | controller | file-I/O + batch | `scripts/ingest.ts` + `documents.ts` (allowlist) | exact |
| `apps/cli/src/commands/list.ts` | controller | CRUD (read) | `documents.ts` GET list + `wait-for-chroma.ts` (exit codes) | exact |
| `apps/cli/src/commands/delete.ts` | controller | CRUD | `documents.ts` DELETE | exact |
| `apps/web/package.json` | config | — | `apps/mcp-server/package.json` | role-match |
| `apps/web/vite.config.ts` | config | request-response | No Vite in repo — `04-RESEARCH.md` Pattern 2 | no analog |
| `apps/web/src/main.tsx` | config | — | No React in repo — `04-RESEARCH.md` Standard Stack | no analog |
| `apps/web/src/App.tsx` | component | request-response | No React in repo — backend REST contracts | no analog |
| `apps/web/src/api/client.ts` | utility | request-response | `apps/cli/src/api-client.ts` (shared pattern) + `errors.ts` | partial |
| `apps/web/src/api/documents.ts` | utility | CRUD + file-I/O | `apps/backend/src/routes/documents.ts` | partial |
| `apps/web/src/api/search.ts` | utility | request-response | `apps/backend/src/routes/search.ts` | partial |
| `apps/web/src/components/UploadPanel.tsx` | component | file-I/O | `documents.ts` upload contract + `04-RESEARCH.md` Pitfall 4/5 | partial |
| `apps/web/src/components/DocumentTable.tsx` | component | CRUD (read) | `packages/core/src/registry/types.ts` (`DocumentRecord`) | partial |
| `apps/web/src/components/SearchPanel.tsx` | component | request-response | `search.ts` response schema | partial |
| `package.json` (root `ingest` script) | config | — | `package.json` + `scripts/ingest.ts` | exact |
| `scripts/ingest.ts` | controller | file-I/O | Superseded by `apps/cli` — keep as thin alias or deprecate | exact |

## Pattern Assignments

### `packages/config/src/env.ts` (config, transform)

**Analog:** Same file — extend existing Zod schema

**Imports pattern** (lines 1-5):
```typescript
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { z } from "zod";
```

**Schema + defaults pattern** (lines 44-67):
```typescript
const envSchema = z.object({
  CHERRYIN_API_KEY: z.string().min(1),
  // ...existing fields...
  BACKEND_HOST: z.string().default("127.0.0.1"),
  BACKEND_PORT: z.coerce.number().default(3000),
  DEFAULT_COLLECTION: z.string().default("default"),
  // ADD:
  AUTH_ENABLED: z.coerce.boolean().default(false),
  API_KEY: z.string().min(1).optional(),
});
```

**Conditional validation — use `.superRefine()`** (RESEARCH.md + existing `SECRET_KEYS` at line 71):
```typescript
const envSchema = z
  .object({ /* ... */ })
  .superRefine((data, ctx) => {
    if (data.AUTH_ENABLED && !data.API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["API_KEY"],
        message: "API_KEY is required when AUTH_ENABLED is true",
      });
    }
  });
```

**Secret redaction already wired** (lines 71-79):
```typescript
const SECRET_KEYS = new Set(["CHERRYIN_API_KEY", "API_KEY"]);

function formatConfigError(error: z.ZodError): void {
  console.error("Invalid environment configuration:");
  for (const issue of error.issues) {
    const field = issue.path.join(".");
    const label = SECRET_KEYS.has(field) ? field : field;
    console.error(`  ${label}: ${issue.message}`);
  }
}
```

**Load + fail-fast** (lines 82-88):
```typescript
export function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    formatConfigError(result.error);
    process.exit(1);
  }
  return result.data;
}
```

---

### `packages/config/src/env.test.ts` (test)

**Analog:** Same file

**Test pattern** (lines 1-12):
```typescript
import { describe, expect, it } from "vitest";
import { loadConfig } from "./env.js";

describe("loadConfig", () => {
  it("returns typed config when required vars are set", () => {
    process.env.CHERRYIN_API_KEY = "test-key";
    const config = loadConfig();
    expect(config.CHUNK_SIZE).toBe(1024);
  });
});
```

**Add tests for:**
- `AUTH_ENABLED=false` (default) without `API_KEY` — succeeds
- `AUTH_ENABLED=true` without `API_KEY` — `process.exit(1)` (mock or spawn subprocess)
- `AUTH_ENABLED=true` with `API_KEY=secret` — typed config includes both

---

### `apps/backend/src/auth.ts` (middleware, request-response)

**Analog:** `apps/backend/src/index.ts` (Fastify plugin registration) — no bearer-auth in repo yet

**Plugin registration pattern** (index.ts lines 24-43):
```typescript
await app.register(fastifySwagger, { /* ... */ });
await app.register(fastifySwaggerUi, { routePrefix: "/docs" });
await app.register(fastifyMultipart, { limits: { files: 1, fileSize: 50 * 1024 * 1024 } });
```

**Auth module shape — extract from bootstrap:**
```typescript
import bearerAuth from "@fastify/bearer-auth";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "@kb/config";

export async function registerBearerAuthIfEnabled(
  app: FastifyInstance,
  config: AppConfig,
): Promise<void> {
  if (!config.AUTH_ENABLED) return;

  await app.register(bearerAuth, {
    keys: new Set([config.API_KEY!]),
    addHook: false, // manual preHandler on /api/v1/* only
  });
}

export function apiRouteOpts(config: AppConfig, app: FastifyInstance) {
  return config.AUTH_ENABLED
    ? { preHandler: [app.verifyBearerAuth] }
    : {};
}
```

**Do NOT** register bearer-auth globally — `/health*` and `/docs` must stay public (health.ts lines 15-42).

---

### `apps/backend/src/index.ts` (bootstrap — auth + static + route order)

**Analog:** Current `apps/backend/src/index.ts` + RESEARCH Pattern 3

**Service bootstrap via factory** (index.ts lines 16-18, services.ts lines 25-55):
```typescript
const services = await createAppServices();
const { config, vectorStore, embeddingClient } = services;
```

**Registration order** (index.ts lines 24-55 — extend):
```typescript
// 1. Swagger (public)
await app.register(fastifySwagger, { /* ... */ });
await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

// 2. Multipart
await app.register(fastifyMultipart, { limits: { files: 1, fileSize: 50 * 1024 * 1024 } });

// 3. Health (public)
await registerHealthRoutes(app, { vectorStore, embeddingClient });

// 4. Bearer auth plugin (no global hook)
await registerBearerAuthIfEnabled(app, config);
const routeOpts = apiRouteOpts(config, app);

// 5. API routes (protected when auth on)
await registerDocumentRoutes(app, { ...deps, routeOpts });
await registerSearchRoutes(app, { searchService: services.searchService, routeOpts });

// 6. Static SPA (prod only) — AFTER API routes
// 7. SPA not-found fallback — AFTER static
```

**Global error handler** (index.ts lines 57-73):
```typescript
app.setErrorHandler((error, _request, reply) => {
  const err = error as Error & { validation?: unknown; statusCode?: number };
  if (err.validation) {
    reply.code(400);
    return { error: "validation_error", message: err.message };
  }
  reply.code(err.statusCode ?? 500);
  return { error: "internal_error", message: err.message };
});
```

**Main entry** (index.ts lines 81-84):
```typescript
main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

**Static + SPA fallback** (RESEARCH Pattern 3 — new, no codebase analog):
```typescript
import fastifyStatic from "@fastify/static";
import { join } from "node:path";

if (process.env.NODE_ENV === "production") {
  await app.register(fastifyStatic, {
    root: join(import.meta.dirname, "../../web/dist"),
    wildcard: false,
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "not_found", message: "Unknown API route" });
    }
    return reply.sendFile("index.html");
  });
}
```

---

### `apps/backend/src/routes/documents.ts` (route, CRUD + file-I/O — add auth)

**Analog:** Same file + extend deps with `routeOpts`

**Deps interface** (lines 29-35 — extend):
```typescript
export interface DocumentsDeps {
  ingestionService: IngestionService;
  registry: DocumentRegistry;
  vectorStore: ChromaVectorStore;
  uploadsDir: string;
  defaultCollection: string;
  routeOpts?: { preHandler?: unknown[] };
}
```

**Apply routeOpts to each route** (lines 51, 99, 103, 115):
```typescript
export async function registerDocumentRoutes(
  app: FastifyInstance,
  deps: DocumentsDeps,
): Promise<void> {
  const opts = deps.routeOpts ?? {};

  app.post("/api/v1/documents", opts, async (request, reply) => { /* ... */ });
  app.get("/api/v1/documents", opts, async () => { /* ... */ });
  app.get("/api/v1/documents/:documentId", opts, async (request, reply) => { /* ... */ });
  app.delete("/api/v1/documents/:documentId", opts, async (request, reply) => { /* ... */ });
}
```

**Upload allowlist — CLI must mirror** (lines 16-27, 42-45):
```typescript
const ALLOWED_MIME = new Set(["text/plain", "text/markdown", "application/pdf"]);
const ALLOWED_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".pdf"]);

function isAllowedUpload(filename: string, mimetype: string): boolean {
  const ext = extname(filename).toLowerCase();
  return ALLOWED_MIME.has(mimetype) && ALLOWED_EXTENSIONS.has(ext);
}
```

**List response shape for web table** (lines 37-40, 99-101):
```typescript
function toPublicDocument(doc: DocumentRecord) {
  const { sourcePath: _sourcePath, ...rest } = doc;
  return rest;
}

app.get("/api/v1/documents", opts, async () => {
  return deps.registry.listDocuments().map(toPublicDocument);
});
```

**Delete response** (lines 115-131):
```typescript
return { status: "deleted", documentId };
```

**Error mapping** (lines 82-96):
```typescript
} catch (error) {
  const mapped = mapIngestError(error);
  return reply.code(mapped.statusCode).send(mapped.body);
}
```

---

### `apps/backend/src/routes/search.ts` (route, request-response — add auth)

**Analog:** Same file — merge `routeOpts` into existing route config object

**Route with Zod schema + opts** (lines 29-55):
```typescript
export interface SearchDeps {
  searchService: SearchService;
  routeOpts?: { preHandler?: unknown[] };
}

export async function registerSearchRoutes(
  app: FastifyInstance,
  deps: SearchDeps,
): Promise<void> {
  app.withTypeProvider<ZodTypeProvider>().post(
    "/api/v1/search",
    {
      schema: {
        body: SearchBodySchema,
        response: { 200: SearchResponseSchema },
      },
      ...(deps.routeOpts ?? {}),
    },
    async (request, reply) => { /* ... */ },
  );
}
```

**Response fields for web SearchPanel** (lines 13-22):
```typescript
const SearchResponseSchema = z.object({
  results: z.array(
    z.object({
      score: z.number(),
      text: z.string(),
      documentId: z.string(),
      filename: z.string(),
      chunkIndex: z.number(),
    }),
  ),
});
```

---

### `apps/backend/src/routes/documents.test.ts` + new auth tests (test)

**Analog:** `apps/backend/src/routes/documents.test.ts`

**buildApp helper** (lines 21-51):
```typescript
async function buildApp(deps?: Partial<Parameters<typeof registerDocumentRoutes>[1]>) {
  const app = Fastify();
  await app.register(fastifyMultipart);
  await registerDocumentRoutes(app, {
    ingestionService: ingestionService as never,
    registry: registry as never,
    vectorStore: vectorStore as never,
    uploadsDir: "./data/uploads",
    defaultCollection: "default",
    ...deps,
  });
  return { app, ingestionService, registry, vectorStore };
}
```

**inject pattern** (lines 56-68):
```typescript
const response = await app.inject({
  method: "GET",
  url: "/api/v1/documents",
});
expect(response.statusCode).toBe(200);
```

**Auth tests to add:** Register bearer-auth in test app with known key; assert `401` without `Authorization` header and `200` with `Authorization: Bearer test-key` on `/api/v1/documents`; assert `/health` stays `200` without auth.

---

### `apps/cli/package.json` + `tsconfig.json` (config)

**Analog:** `apps/mcp-server/package.json` + `apps/mcp-server/tsconfig.json`

**Package scaffold** (mcp-server/package.json lines 1-14):
```json
{
  "name": "@kb/cli",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "bin": {
    "kb": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@kb/config": "workspace:*",
    "@kb/core": "workspace:*",
    "commander": "15.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.13.2",
    "tsx": "^4.22.4",
    "typescript": "^6.0.3",
    "vitest": "^4.1.9"
  }
}
```

**Tsconfig** (mcp-server/tsconfig.json lines 1-9):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false
  },
  "include": ["src/**/*"]
}
```

---

### `apps/cli/src/index.ts` (config, request-response)

**Analog:** `apps/mcp-server/src/stdio.ts` (entry) + Commander (RESEARCH Pattern 4)

**Entry + exit pattern** (stdio.ts lines 10-21):
```typescript
async function main(): Promise<void> {
  const { searchService } = await createMcpServices();
  // ...
}

main().catch((err) => {
  logError(err);
  process.exit(1);
});
```

**Commander program** (RESEARCH Pattern 4):
```typescript
import { Command } from "commander";
import { registerIngestCommand } from "./commands/ingest.js";
import { registerListCommand } from "./commands/list.js";
import { registerDeleteCommand } from "./commands/delete.js";

const program = new Command();
program.name("kb").description("kb-mcp-server admin CLI");

registerIngestCommand(program);
registerListCommand(program);
registerDeleteCommand(program);

program.parse();
```

**Exit codes** (CONTEXT specifics — extend beyond ingest.ts):
- `0` — success
- `1` — usage/validation (Commander handles `--help`; missing args)
- `2` — API/network errors

**Logging to stderr** (mcp-server/logger.ts lines 1-8):
```typescript
export function logError(error: unknown): void {
  const text = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${text}\n`);
}
```

---

### `apps/cli/src/api-client.ts` (utility, request-response)

**Analog:** Backend REST contracts (`documents.ts`, `search.ts`) + `errors.ts` error shape

**Error body contract** (errors.ts lines 3-6):
```typescript
export interface ErrorBody {
  error: string;
  message: string;
}
```

**Client factory** (RESEARCH Pattern 5 — adapt for CLI env):
```typescript
import { loadConfig } from "@kb/config";

export function createApiClient(config = loadConfig()) {
  const baseUrl = `http://${config.BACKEND_HOST}:${config.BACKEND_PORT}`;
  const apiKey = config.AUTH_ENABLED ? config.API_KEY : undefined;

  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (apiKey) {
      headers.set("Authorization", `Bearer ${apiKey}`);
    }
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body as ErrorBody);
    }
    return res;
  }

  return {
    listDocuments: () => request("/api/v1/documents").then((r) => r.json()),
    deleteDocument: (id: string) =>
      request(`/api/v1/documents/${id}`, { method: "DELETE" }).then((r) => r.json()),
    uploadDocument: (filePath: string, collection?: string) => { /* FormData + fs read */ },
    search: (body: { query: string; topK?: number }) =>
      request("/api/v1/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
  };
}
```

**When `AUTH_ENABLED=true`:** fail fast if `API_KEY` missing (config already validates at load).

---

### `apps/cli/src/commands/ingest.ts` (controller, file-I/O + batch)

**Analog:** `scripts/ingest.ts` (direct core) + `documents.ts` (allowlist)

**Direct-core wiring** (ingest.ts lines 46-59):
```typescript
const config = loadConfig();
const settingsStore = initSettingsStore(config);
const registry = getDocumentRegistry(settingsStore.db);
const vectorStore = new ChromaVectorStore(config);
const embeddingClient = new EmbeddingClient(config);
const ingestionService = IngestionService.create(config, {
  registry,
  vectorStore,
  embeddingClient,
  settingsStore,
});
```

**Single-file ingest + JSON output** (ingest.ts lines 58-72):
```typescript
const result = await ingestionService.ingest(filePath, { collection });
console.log(JSON.stringify({
  documentId: result.documentId,
  chunkCount: result.chunkCount,
  collection: result.collection,
}));
```

**Dual-path branch** (CONTEXT decision):
```typescript
if (config.AUTH_ENABLED) {
  await apiClient.uploadDocument(filePath, collection);
} else {
  // direct @kb/core path above
}
```

**Directory walk — filter extensions matching backend** (documents.ts lines 22-27):
```typescript
const ALLOWED = new Set([".txt", ".md", ".markdown", ".pdf"]);

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (ALLOWED.has(extname(entry.name).toLowerCase())) yield full;
  }
}
```

**Replace manual argv parsing** (ingest.ts lines 10-36) with Commander `.option("--collection <name>")`.

---

### `apps/cli/src/commands/list.ts` + `delete.ts` (controller, CRUD)

**Analog:** `documents.ts` GET list + DELETE handlers

**List — REST only** (documents.ts lines 99-101):
```typescript
const docs = await apiClient.listDocuments();
// Print table or JSON to stdout
```

**Delete** (documents.ts lines 115-131):
```typescript
const result = await apiClient.deleteDocument(documentId);
console.log(JSON.stringify(result)); // { status: "deleted", documentId }
```

**404 handling** — map `ErrorBody` with `error: "not_found"` to exit code 1.

---

### `apps/web/package.json` + `vite.config.ts` (config)

**Analog (scaffold):** `apps/mcp-server/package.json` — **Analog (Vite):** RESEARCH Pattern 2 only

**Web package deps** (RESEARCH Standard Stack):
```json
{
  "name": "@kb/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "@tanstack/react-query": "5.101.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "6.0.3",
    "vite": "8.1.3",
    "typescript": "^6.0.3",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

**Vite proxy** (RESEARCH Pattern 2):
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});
```

Use relative URLs (`/api/v1/...`) in fetch — no hard-coded `:3000` in dev.

---

### `apps/web/src/api/client.ts` + `documents.ts` + `search.ts` (utility)

**Analog:** Backend routes + shared client pattern (RESEARCH Pattern 5)

**Bearer from sessionStorage — NOT from Vite env** (CONTEXT auth UX):
```typescript
let apiKey: string | undefined;

export function getApiKey(): string | undefined {
  return apiKey ?? sessionStorage.getItem("kb_api_key") ?? undefined;
}

export function setApiKey(key: string): void {
  apiKey = key;
  sessionStorage.setItem("kb_api_key", key);
}

export async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const key = getApiKey();
  if (key) headers.set("Authorization", `Bearer ${key}`);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401 && !getApiKey()) {
    // trigger prompt flow in UI layer
  }
  if (!res.ok) throw await res.json();
  return res;
}
```

**Upload** (RESEARCH + documents.ts multipart contract):
```typescript
export async function uploadFile(file: File, collection?: string) {
  const form = new FormData();
  form.append("file", file);
  if (collection) form.append("collection", collection);
  const res = await apiRequest("/api/v1/documents", { method: "POST", body: form });
  return res.json(); // { documentId, chunkCount, collection, status: "indexed" }
}
```

**Search** (search.ts body schema lines 7-11):
```typescript
export async function searchDocuments(query: string, topK = 5) {
  const res = await apiRequest("/api/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, topK }),
  });
  return res.json(); // { results: SearchResult[] }
}
```

---

### `apps/web/src/components/DocumentTable.tsx` (component, CRUD read)

**Analog:** `packages/core/src/registry/types.ts` (`DocumentRecord`)

**Fields to display** (types.ts lines 8-18 + CONTEXT specifics):
```typescript
export interface DocumentRecord {
  id: string;
  filename: string;
  sourcePath: string; // omitted in API response
  mimeType: string;
  status: DocumentStatus; // "pending" | "processing" | "indexed" | "failed"
  chunkCount: number;
  collection: string;
  createdAt: string;
  updatedAt: string;
}
```

**Table columns:** `id`, `filename`, `status`, `chunkCount`, `collection`, `createdAt`, `updatedAt`.

**Delete:** confirm dialog → `DELETE /api/v1/documents/:id` → invalidate React Query list cache.

---

### `apps/web/src/components/UploadPanel.tsx` + `SearchPanel.tsx` (component)

**Analog:** Backend contracts + TanStack Query (RESEARCH Don't Hand-Roll)

**UploadPanel patterns:**
- Use `useMutation` for `POST /api/v1/documents`
- Disable submit while `isPending` (Pitfall 5 — sync blocking ingest)
- Surface backend `{ error, message }` on 415/422

**SearchPanel patterns:**
- Use `useMutation` or `useQuery` with manual trigger for test search
- Render `score`, `text`, `documentId`, `filename`, `chunkIndex` from search response
- Default `topK=5`, allow 1–10 (matches SearchBodySchema)

**App shell** (`App.tsx`):
```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* UploadPanel, DocumentTable, SearchPanel, ApiKeyPrompt */}
    </QueryClientProvider>
  );
}
```

---

### `package.json` (root — migrate `ingest` script)

**Analog:** Root `package.json` line 12

**Current:**
```json
"ingest": "tsx scripts/ingest.ts"
```

**Target:**
```json
"ingest": "pnpm --filter @kb/cli dev -- ingest"
```
Or after build: `"ingest": "pnpm --filter @kb/cli exec kb ingest"`

---

### `.env.example` (config)

**Analog:** Same file — AUTH section already stubbed (lines 35-37)

```bash
# --- Optional API key auth (Phase 4; off by default) ---
# AUTH_ENABLED=false
# API_KEY=your_api_key_here
```

Uncomment and document: when `AUTH_ENABLED=true`, web prompts on 401; CLI reads `API_KEY` from env.

---

## Shared Patterns

### Config & Bootstrap

**Source:** `scripts/ingest.ts` + `apps/backend/src/services.ts`

All Node apps load config once via `loadConfig()` from `@kb/config`. Core services use `static create()` factories. CLI direct-core path mirrors `createAppServices()` minus search/uploadsDir.

```typescript
const config = loadConfig();
const settingsStore = initSettingsStore(config);
const registry = getDocumentRegistry(settingsStore.db);
const vectorStore = new ChromaVectorStore(config);
const embeddingClient = new EmbeddingClient(config);
```

### REST API Contract (Admin Surfaces Must Mirror)

**Source:** `apps/backend/src/routes/documents.ts`, `search.ts`

| Method | Path | Success | Error shape |
|--------|------|---------|-------------|
| POST | `/api/v1/documents` | `201` `{ documentId, chunkCount, collection, status }` | `{ error, message }` |
| GET | `/api/v1/documents` | `200` `DocumentRecord[]` (no `sourcePath`) | — |
| DELETE | `/api/v1/documents/:id` | `200` `{ status, documentId }` | `404` `{ error: "not_found", message }` |
| POST | `/api/v1/search` | `200` `{ results: [...] }` | `{ error, message }` |

### Error Handling

**Source:** `apps/backend/src/lib/errors.ts`

```typescript
export interface ErrorBody {
  error: string;
  message: string;
}
```

Web and CLI should display `message` to operators; map HTTP status to UX (401 → prompt for key, 415 → file type hint).

### Auth Boundary

**Source:** CONTEXT CONF-03 + RESEARCH Pattern 1

- Backend: `@fastify/bearer-auth` with `addHook: false`; `preHandler` on `/api/v1/*` only
- Web: `sessionStorage` key after 401 prompt — never `VITE_*` env
- CLI: `API_KEY` from env via `@kb/config` when `AUTH_ENABLED`
- MCP: unchanged — no HTTP auth in Phase 4

### Dependency Injection (Backend Routes)

**Source:** `apps/backend/src/routes/health.ts`, `documents.test.ts`

Routes receive deps via `XxxDeps` + `registerXxxRoutes(app, deps)`. Pass `routeOpts` through deps rather than importing global config inside route modules.

### Vitest (Per Package)

**Source:** `apps/backend/src/routes/documents.test.ts`, `search.test.ts`

- `buildApp()` helper with `vi.fn()` mocks
- `app.inject()` for route tests
- Extend root `vitest.config.ts` projects to include `apps/*` or per-app `vitest.config.ts` like backend

### Package Scaffold Conventions

**Source:** `apps/mcp-server/package.json`, `tsconfig.base.json`

- `"type": "module"` on all apps
- Extend `../../tsconfig.base.json`
- Relative imports use `.js` suffix
- Workspace deps: `"@kb/config": "workspace:*"`, `"@kb/core": "workspace:*"`
- Dev entry: `tsx` / `tsx watch`

### Import Path Conventions

**Source:** Phase 2 PATTERNS + codebase

| Context | Convention |
|---------|------------|
| Workspace packages | `@kb/config`, `@kb/core` |
| Relative backend/cli | `./routes/documents.js` |
| Node built-ins | `node:fs/promises`, `node:path` |

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web/vite.config.ts` | config | request-response | No Vite app in repo; follow RESEARCH Pattern 2 |
| `apps/web/src/main.tsx` | config | — | Greenfield React entry; standard Vite `createRoot` |
| `apps/web/src/App.tsx` | component | request-response | No React components exist; use TanStack Query + REST |
| `apps/web/src/components/*.tsx` | component | mixed | No frontend in repo; bind to `DocumentRecord` + search schema |
| `apps/backend/src/auth.ts` | middleware | request-response | No `@fastify/bearer-auth` usage yet; RESEARCH + index plugin pattern |
| `@fastify/static` SPA fallback | middleware | file-I/O | Not registered in codebase; RESEARCH Pattern 3 |
| `@fastify/cors` | middleware | request-response | Not in backend yet; only if dev bypasses Vite proxy |
| TanStack Query hooks | hook | request-response | No React in repo; RESEARCH Standard Stack |

## Metadata

**Analog search scope:** `apps/backend/src/**`, `apps/mcp-server/**`, `scripts/ingest.ts`, `scripts/wait-for-chroma.ts`, `packages/config/src/**`, `packages/core/src/registry/types.ts`, `.env.example`, root `package.json`, `.planning/phases/02-rest-backend-search/02-PATTERNS.md`
**Files scanned:** 24 source + test + config files
**Pattern extraction date:** 2026-07-04
