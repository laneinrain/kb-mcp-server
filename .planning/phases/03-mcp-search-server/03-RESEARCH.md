# Phase 3: MCP Search Server - Research

**Researched:** 2026-07-01
**Domain:** MCP SDK 1.29 transports, retrieval-only tool design, SearchService integration
**Confidence:** HIGH

## Summary

Phase 3 adds `apps/mcp-server` as a thin transport shell over the existing `SearchService` from Phase 2. The MCP TypeScript SDK v1.29 (`@modelcontextprotocol/sdk@1.29.0`) provides `McpServer`, `StdioServerTransport`, and `StreamableHTTPServerTransport` in a unified package — **not** the v2 alpha split packages. Streamable HTTP is the current MCP-recommended remote transport; legacy HTTP+SSE is deprecated and must not be the sole path (MCP-02 satisfied via Streamable HTTP, which ROADMAP labels "SSE/HTTP").

The highest-risk integration points are: (1) **stdout pollution on stdio** — any `console.log` or dependency writing to stdout breaks JSON-RPC; use stderr only (D-30); (2) **transport parity** — both entrypoints must call the same `buildMcpServer()` so tool schemas and behavior match (D-24); (3) **bounded responses** — delegate top_k clamping to SearchService, never return raw unbounded Chroma payloads (MCP-06); (4) **retrieval-only surface** — resist adding ingest tools; MCP-05 is a negative requirement.

**Primary recommendation:** Plan 03-01 implements `createMcpServices()` + `buildMcpServer()` + unit tests; Plan 03-02 wires stdio + bin; Plan 03-03 adds Streamable HTTP with config env vars and E2E checkpoint. Use SDK import paths: `@modelcontextprotocol/sdk/server/mcp.js`, `.../stdio.js`, `.../streamableHttp.js`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### MCP Server Architecture (D-23 — D-25)
- **D-23:** Tool name `search_knowledge` only
- **D-24:** Single `buildMcpServer(searchService)` shared by stdio and HTTP
- **D-25:** No upload/delete/index tools

#### Search Tool Contract (D-26 — D-28)
- **D-26:** Input `{ query, top_k?, collection? }` → map to SearchService
- **D-27:** Default top_k 5, max 10 via SearchService
- **D-28:** Output fields: score, text, documentId, filename, chunkIndex

#### Transports (D-29 — D-31)
- **D-29:** StdioServerTransport + StreamableHTTPServerTransport at POST /mcp
- **D-30:** stderr-only logging on stdio path
- **D-31:** MCP_HTTP_HOST=127.0.0.1, MCP_HTTP_PORT=3100

#### Service Wiring (D-32 — D-33)
- **D-32:** createMcpServices() — SearchService only
- **D-33:** bin `kb-mcp-server` → stdio entrypoint

### Deferred Ideas (OUT OF SCOPE)
- read_around / read_file tools, list_documents tool, OAuth, legacy SSE-only
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MCP-01 | MCP client connect via stdio and invoke tools | `StdioServerTransport` + bin entry + stderr-only logging |
| MCP-02 | MCP client connect via SSE/HTTP and invoke same tools | `StreamableHTTPServerTransport` at POST /mcp; same buildMcpServer() |
| MCP-03 | Semantic search via `search_knowledge` with ranked results | registerTool handler → SearchService.search() |
| MCP-04 | Results include score, snippet, documentId, filename, chunkIndex | Map SearchResult[] to tool response |
| MCP-05 | Retrieval tools only | Single tool registered; grep gate rejects ingest/CRUD tool names |
| MCP-06 | Bounded responses (top_k defaults, truncated snippets) | SearchService clamp + snippet truncation; Zod max on top_k |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Semantic search & formatting | Core (`SearchService`) | — | Same path as REST; MCP never calls Chroma/embed directly |
| MCP tool registration & schema | MCP app (`buildMcpServer`) | — | Transport-specific shell; Zod inputSchema at tool boundary |
| stdio transport lifecycle | MCP app (`stdio.ts`) | — | Spawned by Cursor; stdin/stdout reserved for JSON-RPC |
| Streamable HTTP transport | MCP app (`http.ts`) | — | Session management, POST /mcp route |
| Config (MCP bind host/port) | `@kb/config` | MCP app | Central env validation |
| Document ingest/CRUD | REST/CLI/Web (Phase 2/4) | — | Explicitly excluded from MCP (MCP-05) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@modelcontextprotocol/sdk` | `1.29.0` | MCP server, transports, tool registration | Stable v1; McpServer + stdio + Streamable HTTP in one package [VERIFIED: npm] |
| `zod` | `^4.4.3` | Tool inputSchema | Already in monorepo; SDK registerTool accepts Zod schemas |
| `@kb/core` | workspace | SearchService | Phase 2 sole retrieval path |
| `@kb/config` | workspace | loadConfig + MCP HTTP vars | Existing Zod env pattern |

### Supporting (HTTP entrypoint)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `express` | `^5.x` | HTTP server for /mcp | SDK examples use express.json() + handleRequest; optional if Node http sufficient |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Streamable HTTP | Legacy SSE-only | Deprecated in MCP spec; rejected per user constraint |
| MCP SDK v2 alpha | SDK v1.29 | v2 API unstable; community examples target v1 |
| Separate server per transport | Shared buildMcpServer | Duplication risks schema drift — rejected per D-24 |
| Ingest tools on MCP | REST-only writes | Violates MCP-05 and PROJECT.md dual-pipeline |

**Installation:**

```bash
pnpm add --filter @kb/mcp-server @modelcontextprotocol/sdk@1.29.0 zod
pnpm add --filter @kb/mcp-server express  # HTTP entrypoint per SDK examples
```

## Architecture Patterns

### Pattern 1: Transport-Agnostic Server Factory

**What:** `buildMcpServer(searchService)` registers tools once; entry files only choose transport.

**Example (from MCP SDK docs + ARCHITECTURE.md Pattern 2):**

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SearchService } from "@kb/core";

export function buildMcpServer(searchService: SearchService): McpServer {
  const server = new McpServer({ name: "kb-mcp-server", version: "0.1.0" });

  server.registerTool(
    "search_knowledge",
    {
      description: "Semantic search over ingested documents. Returns ranked snippets with scores and source metadata.",
      inputSchema: {
        query: z.string().min(1).max(2000),
        top_k: z.number().int().min(1).max(10).optional(),
        collection: z.string().optional(),
      },
    },
    async ({ query, top_k, collection }) => {
      const results = await searchService.search(query, {
        topK: top_k,
        collection,
      });
      return {
        content: [{ type: "text", text: JSON.stringify({ results }, null, 2) }],
        structuredContent: { results },
      };
    },
  );

  return server;
}
```

### Pattern 2: stdio Entry (Local / Cursor)

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServices } from "./services.js";
import { buildMcpServer } from "./server.js";

const { searchService } = await createMcpServices();
const server = buildMcpServer(searchService);
const transport = new StdioServerTransport();
await server.connect(transport);
// Log only to stderr:
console.error("kb-mcp-server running on stdio");
```

**Critical:** Never `console.log` in stdio entrypoint — stdout is the JSON-RPC channel.

### Pattern 3: Streamable HTTP Entry (Remote)

From SDK `simpleStreamableHttp.ts` — stateful session map:

```typescript
import express from "express";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

const transports: Record<string, StreamableHTTPServerTransport> = {};

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => { transports[id] = transport; },
    });
    transport.onclose = () => {
      if (transport.sessionId) delete transports[transport.sessionId];
    };
    const server = buildMcpServer(searchService); // same factory per D-24
    await server.connect(transport);
  } else {
    res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "Bad Request" }, id: null });
    return;
  }
  await transport.handleRequest(req, res, req.body);
});
```

Bind: `app.listen(config.MCP_HTTP_PORT, config.MCP_HTTP_HOST)`.

### Pattern 4: createMcpServices (Search Subset)

Mirror `apps/backend/src/services.ts` without ingestion:

```typescript
export async function createMcpServices(): Promise<{ config: AppConfig; searchService: SearchService }> {
  const config = loadConfig();
  const vectorStore = new ChromaVectorStore(config);
  const embeddingClient = new EmbeddingClient(config);
  const searchService = SearchService.create(config, { vectorStore, embeddingClient });
  return { config, searchService };
}
```

## Common Pitfalls

### Pitfall 1: stdout Pollution (stdio)
**Symptom:** MCP client fails to parse JSON-RPC; hangs or disconnects.
**Mitigation:** stderr-only logging; audit dependencies; never log to stdout in stdio path (D-30).

### Pitfall 2: Duplicate Tool Logic Across Transports
**Symptom:** stdio and HTTP return different schemas or top_k behavior.
**Mitigation:** Single `buildMcpServer()` factory (D-24); entry files only wire transport.

### Pitfall 3: Bypassing SearchService
**Symptom:** MCP and REST search diverge; embedding prefix mismatch.
**Mitigation:** Tool handler calls `searchService.search()` only — grep gate rejects direct Chroma/embed imports in server.ts.

### Pitfall 4: Unbounded Tool Payloads
**Symptom:** Token blowout in LLM context.
**Mitigation:** Zod max top_k=10 + SearchService clamp; snippets already truncated at 500 chars.

### Pitfall 5: Accidental Ingest Tools
**Symptom:** MCP becomes second write path; security/token scope creep.
**Mitigation:** Register only `search_knowledge`; no resources/prompts for file upload (MCP-05).

## Sources

- [MCP TypeScript SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — Streamable HTTP recommended, stdio for local (HIGH)
- [npm @modelcontextprotocol/sdk@1.29.0](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — unified package, transport exports (HIGH)
- `.planning/research/STACK.md` — version pin, Streamable HTTP over legacy SSE (HIGH)
- `.planning/research/PITFALLS.md` — stdout pollution, bounded payloads (HIGH)
- `.planning/research/ARCHITECTURE.md` — Pattern 2 transport-agnostic factory (HIGH)
- `packages/core/src/search/search-service.ts` — existing retrieval implementation (HIGH)

---
*Phase 3 research complete. Ready for plan creation.*
