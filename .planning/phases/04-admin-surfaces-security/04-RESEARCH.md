# Phase 4: Admin Surfaces & Security - Research

**Researched:** 2026-07-04
**Domain:** Vite/React web admin, Commander CLI, optional API key auth (`@fastify/bearer-auth`)
**Confidence:** HIGH

## Summary

Phase 4 completes the admin trifecta promised in PROJECT.md: operators manage the corpus through a **Vite + React SPA** (`apps/web`) and a **Commander CLI** (`apps/cli`), with **optional bearer-token auth** on the Fastify backend (`CONF-03`). Phases 1–3 already provide the REST contract (`/api/v1/documents`, `/api/v1/search`, `/health*`) and a minimal `scripts/ingest.ts` using direct `@kb/core` — Phase 4 **does not reimplement ingestion or search logic**; it adds transport shells that call the existing API (or, for local-only ingest, must still honor auth parity per roadmap criterion 4).

The highest-risk integration points are: (1) **auth scope** — `@fastify/bearer-auth` protects routes by default when `addHook: true`; health (`/health*`) and Swagger (`/docs`) should stay public, while `/api/v1/*` and optionally static admin assets need consistent protection; (2) **CLI/Web auth parity** — when `AUTH_ENABLED=true`, both surfaces must send `Authorization: Bearer <API_KEY>` on every mutating and read admin call (recommend REST client for list/delete/upload; directory ingest walks files and POSTs each); (3) **single corpus view** — web and CLI must read/write through the same REST paths (or the same core services with identical registry/Chroma), never a parallel metadata cache; (4) **dev vs prod web delivery** — dev uses Vite HMR on `:5173` with `server.proxy` to backend `:3000`; prod builds `apps/web/dist` and serves via `@fastify/static` from `@kb/backend` on the same origin to avoid CORS and simplify auth.

**Primary recommendation:** Scaffold `apps/web` (Vite 8 + React 19 + TanStack Query) and `apps/cli` (Commander 15) as thin REST clients; extend `@kb/config` with `AUTH_ENABLED` + `API_KEY`; register `@fastify/bearer-auth` with `addHook: false` and apply `preHandler: fastify.verifyBearerAuth` on `/api/v1` route registration when auth is on; migrate `pnpm ingest` to `apps/cli` while preserving directory-walk for `CLI-01`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WEB-01 | Operator can upload txt, markdown, and text-layer PDF files via web UI | React upload form → `POST /api/v1/documents` multipart (`FormData`); same MIME/extension allowlist as backend |
| WEB-02 | Operator can view list of indexed documents and ingestion status via web UI | `GET /api/v1/documents` → table showing `id`, `filename`, `status`, `chunkCount`, `collection`, timestamps |
| WEB-03 | Operator can delete documents via web UI | `DELETE /api/v1/documents/:documentId` with confirm dialog; refresh list on success |
| WEB-04 | Operator can run test search and view ranked results via web UI | `POST /api/v1/search` with `{ query, topK? }`; render `score`, `text`, `documentId`, `filename`, `chunkIndex` |
| CLI-01 | Operator can ingest files or directories from the command line | Commander `ingest <path>` — file → single POST or direct ingest; directory → recursive walk, filter `.txt/.md/.markdown/.pdf`, ingest each |
| CLI-02 | Operator can list and delete documents from the command line | Commander `list` → `GET /api/v1/documents`; `delete <id>` → `DELETE /api/v1/documents/:id` |
| CONF-03 | Optional API key authentication can be enabled via environment variable | `AUTH_ENABLED` + `API_KEY` in `@kb/config`; `@fastify/bearer-auth` on `/api/v1/*`; web + CLI send `Authorization: Bearer` header |
</phase_requirements>

## Proposed Defaults (locked in 04-CONTEXT.md)

These are research recommendations until discuss-phase locks decisions:

| Area | Proposed default | Rationale |
|------|------------------|-----------|
| Web stack | Vite 8 + React 19 + TanStack Query 5 | PROJECT.md + STACK.md; no Next.js |
| CLI stack | Commander 15 in `apps/cli` | STACK.md; replace ad-hoc `scripts/ingest.ts` argv parsing |
| Admin data path | **REST-first** for web, list, delete, upload | Guarantees CONF-03 parity and roadmap criterion 5 |
| CLI ingest | REST multipart per file when `AUTH_ENABLED`; direct `@kb/core` allowed only when `AUTH_ENABLED=false` | Auth off: fast local path like today; auth on: must hit protected API |
| Auth mechanism | `@fastify/bearer-auth` with `Authorization: Bearer <API_KEY>` | STACK.md; constant-time compare built-in [CITED: github.com/fastify/fastify-bearer-auth] |
| Auth scope | Protect `/api/v1/*` only; `/health*`, `/docs` public | CONF-04 localhost dev; health probes must work without key |
| Web API key UX | Prompt on first `401`; store in `sessionStorage` for session | No secrets in Vite build env |
| Prod web hosting | `@fastify/static` serves `apps/web/dist` from backend | Same origin; no CORS in prod |
| Dev web hosting | Vite `:5173` + proxy `/api` → `http://127.0.0.1:3000` | Standard Vite pattern [CITED: github.com/vitejs/vite server.proxy] |
| Chunk settings UI | **Defer** — no settings REST endpoint exists yet | `.env.example` comment is aspirational; out of WEB-01–04 scope |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Document upload UI | Browser (Vite/React) | API / Backend | Browser handles file picker/drag-drop; backend owns multipart parse + ingest |
| Document list/delete UI | Browser | API / Backend | Pure presentation of REST JSON; no client-side corpus cache beyond React Query |
| Test search UI | Browser | API / Backend → Core (`SearchService`) | Same `/api/v1/search` path as curl/Swagger; MCP uses parallel core path |
| CLI ingest/list/delete | CLI (`apps/cli`) | API / Backend (preferred) or Core (auth-off only) | Terminal UX + exit codes; mutations must respect CONF-03 when auth on |
| Optional API key gate | API / Backend | `@kb/config` | HTTP boundary enforcement; not in browser or MCP stdio |
| Bearer token validation | API / Backend | `@fastify/bearer-auth` | Do not hand-roll timing-safe compare |
| Static admin SPA (prod) | API / Backend | `@fastify/static` | Fastify already owns `:3000`; single deployable unit for local scaffold |
| Parse/chunk/embed/upsert | Core (`IngestionService`) | — | Unchanged from Phase 1; admin surfaces never duplicate |
| Semantic search execution | Core (`SearchService`) | — | Unchanged from Phase 2 |
| MCP retrieval | MCP app | — | Out of Phase 4 scope; no new MCP tools |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vite` | `8.1.3` | Web admin bundler + dev server | Monorepo STACK.md choice; HMR for admin iteration [VERIFIED: npm registry] |
| `react` / `react-dom` | `19.2.7` | UI components | Ecosystem default for Vite admin [VERIFIED: npm registry] |
| `@vitejs/plugin-react` | `6.0.3` | React HMR | Official Vite React plugin [VERIFIED: npm registry] |
| `@tanstack/react-query` | `5.101.2` | Server state / mutations | Upload, list, delete, search with loading/error [VERIFIED: npm registry] |
| `commander` | `15.0.0` | CLI parsing | STACK.md; subcommands `ingest`, `list`, `delete` [VERIFIED: npm registry] |
| `@fastify/bearer-auth` | `10.1.2` | Optional API key gate | Official Fastify bearer plugin; constant-time validation [CITED: github.com/fastify/fastify-bearer-auth] |
| `@fastify/cors` | `11.2.0` | Dev CORS | Only needed if web dev ever bypasses proxy [VERIFIED: npm registry] |
| `@fastify/static` | `9.1.3` | Serve production SPA | Serve `apps/web/dist` from backend [CITED: github.com/fastify/fastify-static] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fastify` | `^5.8.2` (app) | Existing backend | Already in `@kb/backend` |
| `@kb/config` | workspace | `AUTH_ENABLED`, `API_KEY`, URLs | Extend `envSchema` |
| `@kb/core` | workspace | Direct CLI ingest (auth-off) | Mirror `scripts/ingest.ts` wiring |
| `tsx` | `^4.22.4` | Dev entrypoints | `apps/cli` and web via Vite |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| REST-first CLI | Always direct `@kb/core` | Faster but **breaks CONF-03** when auth enabled |
| `@fastify/bearer-auth` | Custom `onRequest` header check | Timing attacks, maintenance — don't hand-roll |
| HTMX + Fastify templates | React + Vite | Zero JS build but conflicts with locked STACK.md |
| Separate web server in prod | `@fastify/static` on backend | Extra port/CORS; worse for local scaffold |
| `X-API-Key` header | `Authorization: Bearer` | Bearer-auth plugin expects Bearer scheme [CITED: fastify-bearer-auth] |

**Installation:**

```bash
# Web admin
pnpm add --filter @kb/web react react-dom @tanstack/react-query
pnpm add -D --filter @kb/web vite @vitejs/plugin-react typescript @types/react @types/react-dom

# CLI
pnpm add --filter @kb/cli commander @kb/config @kb/core
pnpm add -D --filter @kb/cli typescript tsx @types/node

# Backend auth + static
pnpm add --filter @kb/backend @fastify/bearer-auth @fastify/static @fastify/cors
```

**Version verification:** npm view on 2026-07-04 — vite 8.1.3, react 19.2.7, commander 15.0.0, @fastify/bearer-auth 10.1.2, @fastify/cors 11.2.0, @fastify/static 9.1.3, @tanstack/react-query 5.101.2, @vitejs/plugin-react 6.0.3.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Admin Surfaces (Phase 4)                          │
├──────────────────────────────┬──────────────────────────────────────────┤
│  apps/web (Vite + React)     │  apps/cli (Commander)                     │
│  :5173 dev / static in prod  │  kb ingest | list | delete               │
└──────────────┬───────────────┴──────────────────┬───────────────────────┘
               │ HTTP (+ Bearer if AUTH_ENABLED)     │
               ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  apps/backend (Fastify :3000)                                            │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────────────────┐  │
│  │ bearer-auth │  │ /api/v1/* routes │  │ @fastify/static (prod)  │  │
│  │ (optional)  │  │ documents/search │  │ serves apps/web/dist    │  │
│  └─────────────┘  └────────┬─────────┘  └─────────────────────────┘  │
│  /health*  /docs  (public) │                                             │
└────────────────────────────┼─────────────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  packages/core — IngestionService, SearchService, DocumentRegistry       │
└────────────────────────────┬────────────────────────────────────────────┘
                             ▼
                    Chroma sidecar :8000
```

### Recommended Project Structure

```
apps/
├── web/
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   ├── client.ts       # fetch wrapper, Bearer header, base URL
│       │   ├── documents.ts    # upload, list, delete
│       │   └── search.ts       # test search
│       └── components/
│           ├── UploadPanel.tsx
│           ├── DocumentTable.tsx
│           └── SearchPanel.tsx
├── cli/
│   ├── package.json
│   └── src/
│       ├── index.ts            # Commander program + bin
│       ├── api-client.ts       # shared REST client (Bearer, base URL)
│       └── commands/
│           ├── ingest.ts
│           ├── list.ts
│           └── delete.ts
└── backend/
    └── src/
        ├── auth.ts             # registerBearerAuthIfEnabled()
        └── index.ts            # static + CORS + route order
```

### Pattern 1: Optional Bearer Auth on API Routes Only

**What:** Register `@fastify/bearer-auth` with `addHook: false`; apply `preHandler: fastify.verifyBearerAuth` when registering `/api/v1` routes if `AUTH_ENABLED`.

**When to use:** CONF-03 — auth off by default, on when env set.

**Example:**

```typescript
// Source: github.com/fastify/fastify-bearer-auth
import bearerAuth from "@fastify/bearer-auth";

async function registerApiAuth(app: FastifyInstance, config: AppConfig) {
  if (!config.AUTH_ENABLED) return;

  await app.register(bearerAuth, {
    keys: new Set([config.API_KEY!]),
    addHook: false,
  });
}

// In route registration:
const preHandler = config.AUTH_ENABLED ? [app.verifyBearerAuth] : [];
app.post("/api/v1/documents", { preHandler }, handler);
```

### Pattern 2: Vite Dev Proxy to Backend

**What:** Proxy `/api` to `http://127.0.0.1:3000` so the SPA uses relative URLs and avoids CORS.

**Example:**

```typescript
// Source: github.com/vitejs/vite docs/config/server-options.md
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

### Pattern 3: Production SPA from Fastify

**What:** Register `@fastify/static` for `apps/web/dist`; SPA fallback sends `index.html` for non-API 404s. Register **after** API routes, **before** catch-all.

**Example:**

```typescript
// Source: github.com/fastify/fastify-static
import fastifyStatic from "@fastify/static";
import { join } from "node:path";

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
```

### Pattern 4: Commander Subcommands mirroring REST

**What:** `kb ingest`, `kb list`, `kb delete` map 1:1 to existing endpoints.

**Example:**

```typescript
// Source: github.com/tj/commander.js
import { Command } from "commander";

const program = new Command();
program.name("kb").description("kb-mcp-server admin CLI");

program
  .command("list")
  .description("List indexed documents")
  .action(async () => { /* GET /api/v1/documents */ });

program
  .command("delete <documentId>")
  .description("Delete a document and its vectors")
  .action(async (id) => { /* DELETE /api/v1/documents/:id */ });

program
  .command("ingest <path>")
  .option("--collection <name>", "target collection")
  .action(async (path, opts) => { /* file or directory */ });

program.parse();
```

### Pattern 5: Shared API Client with Bearer Token

**What:** One `createApiClient(config)` used by web and CLI; attaches `Authorization` when `API_KEY` present.

**Example:**

```typescript
export function createApiClient(opts: { baseUrl: string; apiKey?: string }) {
  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (opts.apiKey) {
      headers.set("Authorization", `Bearer ${opts.apiKey}`);
    }
    const res = await fetch(`${opts.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body);
    }
    return res;
  }
  return {
    listDocuments: () => request("/api/v1/documents").then((r) => r.json()),
    deleteDocument: (id: string) => request(`/api/v1/documents/${id}`, { method: "DELETE" }),
    search: (body: { query: string; topK?: number }) =>
      request("/api/v1/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    uploadDocument: (file: Blob, filename: string, collection?: string) => {
      const form = new FormData();
      form.append("file", file, filename);
      if (collection) form.append("collection", collection);
      return request("/api/v1/documents", { method: "POST", body: form });
    },
  };
}
```

### Anti-Patterns to Avoid

- **Parallel ingest in web via `@kb/core`:** Breaks auth boundary and duplicates backend wiring.
- **Global bearer hook on all routes:** Breaks `/health` probes and Swagger unless explicitly exempted.
- **Storing API key in `VITE_*` env:** Leaks into client bundle; use runtime prompt + sessionStorage.
- **CLI always bypassing HTTP when auth on:** Violates CONF-03 and roadmap criterion 4.
- **Separate document list cache in web:** Causes stale UI; use React Query `invalidateQueries` after mutations.
- **Adding upload/search MCP tools:** Violates MCP-05 and PROJECT.md dual-pipeline.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bearer token validation | Custom header string compare | `@fastify/bearer-auth` | Constant-time compare, 401 handling [CITED: fastify-bearer-auth] |
| CLI argv parsing | Manual `process.argv` loop | Commander 15 | Subcommands, help, options — replace `scripts/ingest.ts` pattern |
| Dev server + HMR | Custom esbuild watch | Vite 8 | Standard React admin toolchain |
| Upload progress/state | Ad-hoc useState spaghetti | TanStack Query mutations | Built-in `isPending`, error, retry |
| Directory recursion filter | Shell `find` dependency | Node `fs.readdir` walk | Cross-platform (Windows dev per README) |
| CORS/proxy logic | Hard-coded fetch URLs | Vite `server.proxy` (dev) + same-origin static (prod) | Eliminates preflight in prod |

**Key insight:** Phase 4 is almost entirely **wiring** — the hard problems (ingest, search, Chroma, embeddings) are solved in `@kb/core` and exposed via Phase 2 REST.

## Common Pitfalls

### Pitfall 1: Admin Test Search Diverges from MCP

**What goes wrong:** Web search returns different rankings than `search_knowledge` in Cursor.

**Why it happens:** Web calls a different code path or passes different `topK`/collection defaults.

**How to avoid:** Web uses `POST /api/v1/search` only — same `SearchService` as MCP. Display default `topK=5`; allow 1–10.

**Warning signs:** Same query, different top result between Swagger and MCP.

### Pitfall 2: Auth Enabled but CLI Still Uses Direct Core

**What goes wrong:** Backend rejects anonymous REST, but CLI still ingests via `IngestionService` — false sense of security.

**Why it happens:** Migrating `scripts/ingest.ts` without auth branch.

**How to avoid:** When `AUTH_ENABLED`, CLI **must** use REST (or fail fast if no `API_KEY`). Document in `.env.example`.

**Warning signs:** `AUTH_ENABLED=true` but ingest works without `API_KEY` in env.

### Pitfall 3: Route Registration Order Breaks SPA or Swagger

**What goes wrong:** Static catch-all swallows `/api/v1/*` or `/docs`.

**Why it happens:** `@fastify/static` registered before API routes.

**How to avoid:** Order: health → swagger → multipart → bearer setup → API routes → static → SPA not-found handler.

**Warning signs:** 404 HTML for JSON API calls; Swagger UI blank.

### Pitfall 4: Upload MIME Mismatch from Web

**What goes wrong:** Browser sends `application/octet-stream` for `.md` files → backend 415.

**Why it happens:** Backend checks both extension and MIME (`documents.ts` `isAllowedUpload`).

**How to avoid:** Use `File` from input as-is; optionally set type from extension map before append; show backend error message in UI.

**Warning signs:** 415 `unsupported_media_type` on valid files.

### Pitfall 5: Long Sync Ingest Blocks Web UI

**What goes wrong:** Large PDF upload appears frozen — no feedback during blocking ingest (D-11 sync semantics from Phase 2).

**Why it happens:** `POST /documents` blocks until embed completes.

**How to avoid:** Disable submit button, show spinner/progress text ("Indexing… may take a minute"). Async ingest is deferred v2.

**Warning signs:** User double-clicks upload, causing duplicate requests.

### Pitfall 6: Directory Ingest Includes Unsupported Files

**What goes wrong:** CLI walks directory, hits `.docx`, crashes or spams errors.

**How to avoid:** Filter by extension set matching backend: `.txt`, `.md`, `.markdown`, `.pdf`; skip others with summary count.

**Warning signs:** Hundreds of 415 errors in logs.

## Code Examples

### Config: AUTH_ENABLED + API_KEY

```typescript
// Extend packages/config/src/env.ts
const envSchema = z
  .object({
    // ...existing fields...
    AUTH_ENABLED: z.coerce.boolean().default(false),
    API_KEY: z.string().min(1).optional(),
  })
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

### Web Upload with FormData

```typescript
// apps/web/src/api/documents.ts
export async function uploadFile(file: File, apiKey?: string) {
  const form = new FormData();
  form.append("file", file);
  const headers: HeadersInit = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetch("/api/v1/documents", { method: "POST", headers, body: form });
  if (!res.ok) throw await res.json();
  return res.json(); // { documentId, chunkCount, collection, status }
}
```

### CLI Directory Ingest Walk

```typescript
// apps/cli/src/commands/ingest.ts
import { readdir, stat } from "node:fs/promises";
import { join, extname } from "node:path";

const ALLOWED = new Set([".txt", ".md", ".markdown", ".pdf"]);

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (ALLOWED.has(extname(entry.name).toLowerCase())) yield full;
  }
}
```

### Backend Auth Wiring Sketch

```typescript
// apps/backend/src/index.ts (conceptual)
await registerHealthRoutes(app, deps); // no auth
await registerSwagger(app);            // no auth

if (config.AUTH_ENABLED) {
  await app.register(bearerAuth, {
    keys: new Set([config.API_KEY!]),
    addHook: false,
  });
}

const apiPreHandler = config.AUTH_ENABLED
  ? { preHandler: app.verifyBearerAuth }
  : {};

await registerDocumentRoutes(app, { ...deps, routeOpts: apiPreHandler });
await registerSearchRoutes(app, { ...deps, routeOpts: apiPreHandler });

if (process.env.NODE_ENV === "production") {
  await registerWebStatic(app);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `scripts/ingest.ts` manual argv | Commander subcommands in `apps/cli` | Phase 4 | `pnpm ingest` becomes CLI alias |
| No auth on backend | Optional `@fastify/bearer-auth` | Phase 4 CONF-03 | Web/CLI need Bearer header when enabled |
| API-only admin | REST + Web + CLI trifecta | Phase 4 | Completes PROJECT.md admin surfaces |
| Separate dev servers without proxy | Vite proxy `/api` → backend | Phase 4 | Simpler fetch URLs |

**Deprecated/outdated:**
- **Manual argv ingest script** as primary CLI — superseded by Commander `apps/cli`
- **Assuming admin shares MCP auth** — MCP HTTP auth is separate (optional future); Phase 4 scopes backend + web + CLI only

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | MCP HTTP auth is out of Phase 4 scope | Summary | Remote MCP stays unauthenticated until a later phase |
| A2 | `/docs` and `/health*` remain public when auth on | Proposed Defaults | Ops may want protected Swagger — discuss |
| A3 | Chunk settings web UI is deferred | Proposed Defaults | User may expect `.env.example` "Web UI can override" in Phase 4 |
| A4 | `sessionStorage` for web API key is acceptable | Pattern 5 | User may prefer env-only or basic browser prompt |
| A5 | CLI direct-core ingest when auth off matches "respect auth configuration" | CLI ingest | Strict reading may require REST-only always |

## Open Questions (RESOLVED)

1. **MCP HTTP bearer auth**
   - **RESOLVED:** Deferred to follow-up phase — CONF-03 scopes backend/web/CLI only (see CONTEXT.md deferred).

2. **REST-only CLI vs dual-path ingest**
   - **RESOLVED:** Dual-path per CONTEXT.md — direct `@kb/core` when `AUTH_ENABLED=false`; REST multipart when auth on.

3. **Chunk size/overlap settings UI**
   - **RESOLVED:** Deferred — no REST endpoint for SettingsStore; Phase 4 uses env/bootstrap defaults only.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All apps | ✓ | v24.13.0 | — |
| pnpm | Monorepo | ✓ | 11.9.0 | — |
| CherryIn API | Ingest/search | ✓ (user `.env`) | — | Blocks upload/search E2E |
| Chroma sidecar | Vectors | ✓ via `pnpm dev` | — | Ingest/search fail |
| Backend `:3000` | Web/CLI REST | ✓ when `pnpm dev` | — | Start backend first |
| Python + chromadb | Chroma on Windows | ✓ via `pnpm setup:chroma` | — | Documented in README |

**Missing dependencies with no fallback:**
- Valid `CHERRYIN_API_KEY` for live ingest/search verification

**Missing dependencies with fallback:**
- None blocking Phase 4 implementation (scaffold code can use mocked tests like Phase 2)

## Project Constraints (from `.cursor/rules/`)

- **TypeScript/Node** — all new apps in `apps/web`, `apps/cli`; no Python admin
- **Local-first** — default bind `127.0.0.1`; `AUTH_ENABLED` off by default
- **Secrets in `.env` only** — `API_KEY`, `CHERRYIN_API_KEY`; never commit; web must not bake secrets into Vite build
- **MCP retrieval-only** — Phase 4 must not add upload/delete/search admin tools to MCP
- **Text-layer PDF only** — web/CLI communicate backend validation errors; no OCR
- **GSD workflow** — execute via `/gsd-execute-phase` plans, not ad-hoc drive-by edits

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `@fastify/bearer-auth` bearer token when `AUTH_ENABLED` |
| V3 Session Management | no | Stateless API key per request; no server sessions |
| V4 Access Control | yes | All `/api/v1/*` require valid Bearer when auth on |
| V5 Input Validation | yes | Existing Zod/multipart validation on backend; web/CLI don't bypass |
| V6 Cryptography | partial | Rely on plugin constant-time compare; don't log `API_KEY` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Missing auth on admin API | Spoofing | `AUTH_ENABLED` + bearer-auth on `/api/v1/*` |
| API key in client bundle | Information disclosure | Runtime prompt / sessionStorage; `API_KEY` only in server/CLI env |
| Unauthorized document upload | Tampering | Auth gate on `POST /documents` |
| Timing attack on API key compare | Information disclosure | `@fastify/bearer-auth` constant-time compare |
| Binding backend to `0.0.0.0` without auth | Information disclosure | Keep `BACKEND_HOST=127.0.0.1` default (CONF-04) |

## Sources

### Primary (HIGH confidence)
- [github.com/fastify/fastify-bearer-auth](https://github.com/fastify/fastify-bearer-auth) — plugin registration, `addHook: false`, manual `preHandler`
- [github.com/vitejs/vite](https://github.com/vitejs/vite/blob/main/docs/config/server-options.md) — `server.proxy`
- [github.com/fastify/fastify-static](https://github.com/fastify/fastify-static) — static root, SPA 404 handler
- [github.com/tj/commander.js](https://github.com/tj/commander.js) — subcommands, actions
- [VERIFIED: npm registry] — package versions 2026-07-04
- Codebase: `apps/backend/src/routes/documents.ts`, `search.ts`, `packages/config/src/env.ts`, `scripts/ingest.ts`

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md` — monorepo layout, library choices
- `.planning/research/ARCHITECTURE.md` — admin surfaces call REST; dual pipeline
- `.planning/phases/02-rest-backend-search/02-RESEARCH.md` — API contracts, error shapes
- `.planning/research/PITFALLS.md` — admin/MCP auth exposure patterns

### Tertiary (LOW confidence)
- None asserted as fact without verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm-verified versions; matches existing STACK.md and implemented backend
- Architecture: HIGH — REST contract exists; greenfield web/cli only
- Pitfalls: HIGH — derived from Phase 2 sync ingest, CONF-03 wording, and existing route code

**Research date:** 2026-07-04
**Valid until:** 2026-08-04 (stable admin patterns; auth plugin slow-moving)
