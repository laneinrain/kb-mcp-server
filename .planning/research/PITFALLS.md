# Pitfalls Research

**Domain:** Knowledge-base MCP server with vector RAG (Chroma, external embeddings, PDF ingestion, dual stdio/SSE transports)
**Researched:** 2026-06-29
**Confidence:** HIGH (MCP SDK official docs, Chroma deployment docs, multiple RAG post-mortems); MEDIUM for CherryIn/Qwen3-specific API quirks (provider not independently verified)

## Critical Pitfalls

### Pitfall 1: Stdout Pollution Breaks stdio MCP

**What goes wrong:**
The MCP host connects over stdio but immediately fails with JSON-RPC parse errors, hangs, or "server not responding." Search never runs even though the backend and Chroma work fine over HTTP.

**Why it happens:**
On stdio transport, stdout is exclusively the JSON-RPC wire. Any `console.log`, startup banner, dotenv warning, or dependency debug output on stdout corrupts framing. Transitive packages often write to stdout by default. The MCP TypeScript SDK explicitly requires `console.error()` for logging.

**How to avoid:**
- Redirect or ban stdout logging before any other imports in the stdio entrypoint.
- Use structured logging to stderr only (`console.error`, pino with `destination: 2`).
- Audit third-party libs (DB drivers, HTTP debug) for stdout writes during startup.
- Run MCP Inspector and pipe stdin from `/dev/null` — anything non-JSON on stdout is a bug.

**Warning signs:**
- Host log shows "Unexpected token" or "invalid JSON-RPC" on first connection.
- Server works when run manually in a terminal but fails when spawned by Cursor/Claude Desktop.
- Intermittent failures after adding a new dependency.

**Phase to address:**
Phase 4 (MCP Search Server — stdio entrypoint)

---

### Pitfall 2: Multiple Processes Sharing One Chroma Persistent Path

**What goes wrong:**
SQLite index corruption, stale query results, random crashes during concurrent ingest + search, or "database is locked" errors. Data loss may not surface until restart.

**Why it happens:**
Chroma `PersistentClient` (embedded mode) holds an exclusive lock on a local SQLite backing store. It is thread-safe within one process but **not process-safe**. This scaffold runs MCP server, REST backend, CLI, and possibly web workers — all touching the same `./.chroma` path by default.

**How to avoid:**
- **Single-process embedded Chroma:** Only one long-lived writer process owns the path; others read via HTTP to a Chroma server, or serialize all access through one backend service.
- **Recommended for dual-transport + backend:** Run Chroma in server mode (`chroma run --path ./.chroma`) and connect all components via `HttpClient` on localhost.
- Document the deployment pattern in README: one Chroma instance, many HTTP clients.
- Never point CLI ingest and MCP search at separate embedded clients on the same directory.

**Warning signs:**
- Ingest succeeds but MCP search returns empty or old results.
- `SQLITE_BUSY` / lock errors in logs during parallel upload + search.
- Index file size stops growing while ingest reports success.

**Phase to address:**
Phase 2 (Embedding & Chroma Layer) — decide embedded vs server mode before any ingest code

---

### Pitfall 3: Query-Time vs Index-Time Embedding Mismatch

**What goes wrong:**
Search returns irrelevant chunks with high confidence, or throws dimension errors. After changing the CherryIn model or config, existing documents appear "indexed" but retrieval is nonsense.

**Why it happens:**
Each embedding model defines its own vector space. Query vectors from `qwen/qwen3-embedding-8b` cannot be compared to vectors from a different model — even if dimensions happen to match. Some vector DBs accept mismatched dimensions silently and return garbage scores.

**How to avoid:**
- Single shared embedding module used by **both** ingest pipeline and MCP search path — never duplicate API client config.
- Store `embedding_model` and `embedding_dim` in collection metadata and on every chunk; validate at query time before search.
- On model change: new collection name or path (e.g. `kb_v1_qwen3`), full re-embed — never overwrite in place.
- Pin model string in config; treat model change as a migration with a checklist.

**Warning signs:**
- Search "works" (returns results) but answers are consistently wrong after a config edit.
- Dimension error only appears at query time, not at startup.
- Mixing test ingest with one API key/env and production query with another.

**Phase to address:**
Phase 2 (Embedding & Chroma Layer) — shared client + metadata; Phase 3 (Ingestion) — write metadata; Phase 4 (MCP) — read same client

---

### Pitfall 4: Scanned PDFs Silently Produce Ghost Vectors

**What goes wrong:**
PDF upload succeeds, chunks are created, embeddings are stored — but search never finds content the user can see in a PDF viewer. Empty or whitespace-only chunks pollute the index.

**Why it happens:**
Text-layer-only extraction (`pdf-parse`, `pdfjs`) returns empty strings for image-only (scanned) PDFs with no error. Viewers render the image, so users assume the file is valid. v1 explicitly excludes OCR, but without validation the pipeline still indexes empties.

**How to avoid:**
- After extraction, reject documents where `extracted_text.trim().length < threshold` (e.g. 100 chars total or per-page average).
- Return a clear ingest error: "No text layer detected — scanned PDF not supported in v1."
- Optionally sample first page text in web admin preview before full ingest.
- Store `source_type`, `page_count`, `extracted_char_count` in document metadata for debugging.

**Warning signs:**
- Upload shows N chunks but test search for unique phrases from the PDF returns nothing.
- Chunks contain only whitespace or page numbers/headers.
- Small file size + many pages (typical of compressed scans).

**Phase to address:**
Phase 3 (Ingestion Backend — PDF parsing & validation)

---

### Pitfall 5: Putting Ingestion/Upload on MCP Tools

**What goes wrong:**
MCP host freezes during large uploads; stdio server times out; Cursor loses connection; embedding API rate limits cascade into broken agent sessions.

**Why it happens:**
MCP tools are designed for quick, agent-invoked actions. Ingestion is slow (parse → chunk → batch embed → upsert). Many RAG+MCP scaffolds expose `upload_document` on MCP for convenience; agents retry failed calls, multiplying API cost.

**How to avoid:**
- Keep MCP retrieval-only (`search_knowledge`, maybe `list_documents` / `get_chunk`) as decided in PROJECT.md.
- All upload/CRUD via REST, web admin, CLI — outside the agent loop.
- If a future phase adds admin MCP tools, gate them behind a separate server or explicit opt-in, not the default search server.

**Warning signs:**
- Tool execution exceeds host timeout (30–120s).
- Progress notifications on stdio cause hangs (known SDK class of bugs).
- Agent session breaks after "upload" tool calls.

**Phase to address:**
Phase 4 (MCP Search Server) — scope guard; Phase 6 (Admin Surfaces) — ingest stays off MCP

---

### Pitfall 6: Returning Unbounded Search Results to the Model

**What goes wrong:**
Agent context explodes; session resets; credits burn on chunk text that never gets read; chained tool calls fail mid-workflow.

**Why it happens:**
RAG MCP tools often return full chunk text for top-k results. With k=10 and 1–2 KB chunks, a single search can inject 10–20 KB+ into context. Hosts forward entire tool payloads to the LLM with no truncation.

**How to avoid:**
- Cap `top_k` server-side (default 3–5 for MCP; allow override with hard max e.g. 10).
- Truncate chunk `content` in tool response (e.g. 500–800 chars) with `...` and include `chunk_id` / `document_id` for follow-up.
- Return structured fields: `score`, `title`, `source_path`, `snippet`, not always full body.
- Optionally expose a separate `get_chunk(chunk_id)` for on-demand full text.
- Document expected token budget in tool description so models query narrowly.

**Warning signs:**
- Context limit errors immediately after search tool use.
- Tool response JSON exceeds 50–100 KB.
- Model repeats entire document sections verbatim without being asked.

**Phase to address:**
Phase 4 (MCP Search Server — tool response shaping)

---

### Pitfall 7: Divergent stdio and SSE Implementations

**What goes wrong:**
Search works locally via Cursor stdio but fails over SSE (or vice versa): different tool names, schemas, auth, or Chroma connection strings. Bugs fixed in one entrypoint regress in the other.

**Why it happens:**
Two transports tempt copy-paste entrypoints with duplicated tool registration, env parsing, and error handling. SSE adds HTTP session lifecycle, CORS, and proxy concerns stdio doesn't have.

**How to avoid:**
- Single `buildMcpServer()` factory shared by stdio and SSE/HTTP entrypoints — transport is the only difference.
- Shared config module; integration test that lists tools from both transports and asserts identical schemas.
- Note: MCP SDK recommends Streamable HTTP for new remote servers; SSE is legacy but PROJECT.md requires SSE — implement SSE via SDK's supported path, share core with future streamable HTTP if added.

**Warning signs:**
- Tool count or `inputSchema` differs between transports.
- Only one entrypoint gets bugfixes.
- SSE works in MCP Inspector but not behind nginx/Cursor remote config.

**Phase to address:**
Phase 4 (stdio) and Phase 5 (SSE Transport) — shared server factory from day one of Phase 4

---

### Pitfall 8: Unstable Chunk IDs and Orphan Vectors on Re-Ingest

**What goes wrong:**
Re-uploading an updated document leaves old chunks in Chroma; search returns both old and new (contradictory) content. Deleting a document in admin doesn't remove all vectors; "ghost" citations persist.

**Why it happens:**
Chunk IDs derived from `(content hash + index)` change when chunk boundaries shift. Without a durable `document_id → chunk_ids` mapping, delete-by-filter misses orphans. Vector stores are append-friendly; deletion is explicit and easy to get wrong.

**How to avoid:**
- Stable `document_id` (UUID or content-addressed hash of source file at first ingest).
- Stable `chunk_id` = `{document_id}:{chunk_index}` or hash of `(document_id, start_offset, end_offset)`.
- On update: delete all vectors where `metadata.document_id == X`, then upsert new chunks in one logical operation.
- Maintain ingest registry (SQLite/JSON sidecar or backend DB table): `document_id`, `content_hash`, `chunk_ids[]`, `ingested_at`.
- Weekly orphan sweep optional for v1; at minimum verify delete in admin test search.

**Warning signs:**
- Same filename uploaded twice increases collection count without replacing.
- Deleted doc still appears in search until manual collection reset.
- Chunk count grows monotonically despite "replace" semantics.

**Phase to address:**
Phase 3 (Ingestion — ID strategy & delete path); Phase 6 (Admin — delete UI must call full cleanup)

---

### Pitfall 9: Partial Ingest Without Resumability

**What goes wrong:**
Large document ingest fails mid-batch (429 rate limit, network blip); half the chunks are embedded, document is marked failed or worse marked success; search returns incomplete coverage with no error.

**Why it happens:**
External embedding APIs (CherryIn OpenAI-compatible) enforce rate limits and payload sizes. Naive "embed all chunks in one loop" fails on chunk 47 of 200 with no checkpoint.

**How to avoid:**
- Batch embed with configurable batch size; retry with exponential backoff on 429/5xx; respect `Retry-After`.
- Persist raw extracted text + chunk boundaries **before** embedding (Stage 3 before Stage 4 pattern).
- Ingest job states: `parsed → chunked → embedding → complete | failed`; retry resumes from last completed batch.
- Idempotent upsert by `chunk_id` so retries don't duplicate.
- Surface partial failure clearly in admin UI (e.g. "12/45 chunks embedded").

**Warning signs:**
- Ingest error rate correlates with document size.
- CherryIn 429 in logs with no retry.
- Search finds beginning of long PDF but not later sections.

**Phase to address:**
Phase 2 (Embedding client — retry/rate limit); Phase 3 (Ingestion — staged pipeline)

---

### Pitfall 10: Chroma JS Client — Missing Explicit Embeddings

**What goes wrong:**
`add` and `query` throw `Embedding function must be defined` or silent failures when using `@chroma-core/default-embed` without installing the package.

**Why it happens:**
Chroma JS v3+ expects either pre-computed embeddings on every upsert/query **or** an explicitly registered embedding function. This project uses external CherryIn embeddings — the correct pattern — but developers may call `collection.add({ documents })` without `embeddings` and assume Chroma embeds locally.

**How to avoid:**
- Always pass `embeddings` array on upsert; always embed query string before `collection.query({ queryEmbeddings })`.
- Never rely on Chroma default embedding function for this scaffold.
- TypeScript types/wrapper that makes `embeddings` required on write paths.

**Warning signs:**
- Error mentions `@chroma-core/default-embed` or "Embedding function must be defined".
- Python Chroma tutorials copied into TS without adaptation.

**Phase to address:**
Phase 2 (Chroma wrapper — typed upsert/query API)

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Embedded Chroma in backend only; MCP reads same path via second PersistentClient | No separate Chroma process to run | Index corruption under concurrent access | **Never** for this architecture |
| Fixed 512-char character chunking for all formats | Fast to implement | Broken markdown structure, split sentences, poor recall | MVP only if md/txt use heading-aware splitter; PDF gets paragraph boundaries |
| Single `search` tool returning raw chunks only | Minimal MCP surface | Context bloat, no citation structure for agents | Never — add snippet truncation + metadata from start |
| Hardcode collection name `"default"` everywhere | Ships faster | Multi-collection migration breaks all callers | v1 OK if wrapped in one `getDefaultCollection()` accessor |
| Skip ingest registry; rely on Chroma metadata alone | Less code | Delete/update/re-ingest orphans | Never |
| SSE without heartbeat/proxy config | Simpler server | Silent disconnects after 60s behind nginx | Dev-only; document proxy settings for remote use |
| In-memory rate limiter per server instance | Easy 429 handling | Fails with multiple backend workers | Acceptable for single-process localhost scaffold |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| CherryIn OpenAI-compatible API | Assuming OpenAI SDK defaults (`text-embedding-3-small`, wrong base URL) | Explicit `baseURL`, model `qwen/qwen3-embedding-8b`, verify response vector length once and store |
| CherryIn embeddings | No batching; one HTTP call per chunk | Batch inputs per API limits; concurrent cap (e.g. 3–5 in flight) |
| Chroma embedded | Same path from MCP + backend + CLI | Chroma HTTP server on localhost; one data directory |
| Chroma query | Passing query text without pre-embedding | Embed query with same module as ingest; pass `queryEmbeddings` |
| PDF (pdf-parse / pdfjs) | Trust visual render = text layer | Validate extracted length; reject scans with user-visible error |
| MCP stdio host (Cursor) | Env vars in shell profile, not MCP config | Pass `CHERRYIN_API_KEY`, `CHROMA_URL` in host `env` block |
| MCP SSE (remote) | No CORS, no auth on MCP endpoint | Bind localhost by default; optional API key middleware in Phase 7 |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous full re-embed on every file save | Upload API timeout; blocked search | Background job queue or async ingest with status polling | >20 pages or >100 chunks per doc |
| Large Chroma upsert batches | OOM or slow SQLite writes | Batch size 50–100 vectors; tune from Chroma docs | >1k chunks single ingest |
| MCP search embeds on every call without cache | Latency 200–500ms+; API cost | Optional query embedding cache (TTL 5–15 min) for repeated queries | Agent loops same query 10+ times |
| Loading entire collection metadata for list | Slow admin page | Paginate list; index metadata in sidecar DB | >500 documents |
| No connection pooling to Chroma HTTP | Latency under concurrent MCP + admin | Reuse single HttpClient instance per process | >5 concurrent searches |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| MCP SSE bound to `0.0.0.0` without auth | Anyone on network searches private KB | Default `127.0.0.1`; optional API key gate (Phase 7) |
| Backend upload without auth in shared LAN | Arbitrary document injection into agent context | Env-flag API key; document in README for dev vs hardened mode |
| Tool responses include full filesystem paths | Path leakage in shared logs/context | Return `document_id` + display name; strip absolute paths |
| `.env` with CherryIn key committed | API abuse, billing | `.gitignore`, example `.env.example` only; pre-commit secret scan |
| Ingest accepts arbitrary file types | Zip bombs, parser exploits | MIME/extension allowlist (txt, md, pdf); max file size cap |
| Search tool as SSRF vector if query passed to URL fetch | N/A if search is local only | Never fetch URLs in search path; local Chroma only |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Upload succeeds with no searchable content (scan PDF) | "Broken product" — silent failure | Fail fast with explicit message + link to text-layer requirement |
| Test search in admin uses different embed path than MCP | "Works in admin, broken in Cursor" | Admin test search calls same shared search service MCP uses |
| No ingest progress for large PDFs | User re-uploads, duplicates orphans | Progress bar or staged status (parsing / embedding / done) |
| Opaque chunk snippets in MCP results | Agent can't cite sources | Include `document_title`, `source_filename`, `chunk_index`, `score` |
| CLI requires manual Chroma start with no check | Cryptic connection errors | Startup health check: Chroma heartbeat + CherryIn embed probe |
| Re-ingest same file creates duplicates | Confusing contradictory answers | Upsert by `content_hash` or prompt "replace existing?" |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **stdio MCP:** Verified zero non-JSON stdout (Inspector + spawned process test)
- [ ] **Search tool:** Response size bounded; full text not dumped for large k
- [ ] **Embeddings:** Same model + dimension on ingest and query; metadata stored on collection
- [ ] **Chroma:** Only one process writes to embedded path OR all clients use HTTP server mode
- [ ] **PDF ingest:** Empty/scanned PDF rejected with clear error, not indexed
- [ ] **Delete document:** All chunk IDs removed; test search returns zero hits for deleted content
- [ ] **Re-upload:** Old chunks replaced, not duplicated
- [ ] **SSE transport:** Same tool schemas as stdio; connection survives >2 min (heartbeat if proxied)
- [ ] **Partial ingest failure:** Resumable or clearly marked failed; no "half-indexed" success state
- [ ] **Secrets:** CherryIn key only from env; fails loudly at startup if missing

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Chroma SQLite corruption | MEDIUM | Stop all processes; backup `./.chroma`; delete index; re-ingest from source files via CLI |
| Embedding model mismatch | HIGH | New collection name; full re-embed all documents; switch query traffic atomically |
| Ghost/orphan chunks | LOW–MEDIUM | Delete collection metadata filter by `document_id`; or wipe collection + re-ingest registry-driven |
| stdout pollution in production | LOW | Fix logging; restart MCP host process (no data migration) |
| Scanned PDFs already indexed | LOW | Delete by `document_id`; re-upload after OCR (out of v1 scope) or exclude |
| Partial ingest | LOW | Reset document job to `chunked`; retry embed from checkpoint; idempotent upsert |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Stdout pollution | Phase 4 (MCP stdio) | MCP Inspector connect; grep stdout for non-JSON lines |
| Chroma multi-process corruption | Phase 2 (Chroma layer) | Parallel ingest + search soak test without lock errors |
| Embedding mismatch | Phase 2 + 3 + 4 | Unit test: ingest embed dim === query embed dim; metadata assertion |
| Scanned PDF ghost vectors | Phase 3 (Ingestion) | Upload scan sample; expect 4xx + zero new chunks |
| Ingestion on MCP tools | Phase 4 (scope) | Tool list has no upload/ingest tools |
| Unbounded search payloads | Phase 4 (MCP tools) | Measure tool response bytes < 10 KB default |
| Divergent transports | Phase 4 + 5 | Automated schema parity test both entrypoints |
| Unstable chunk IDs / orphans | Phase 3 + 6 | Re-upload doc → chunk count stable; delete → search empty |
| Partial ingest failure | Phase 2 + 3 | Kill network mid-ingest; retry completes without duplicates |
| Chroma explicit embeddings | Phase 2 | Upsert/query without embeddings throws at compile or runtime |

### Suggested phase ordering rationale

1. **Phase 2 before Phase 3/4** — Chroma deployment mode and embedding client must be correct before any data is written; wrong choices force full re-index.
2. **Phase 3 before Phase 4** — Ingest validation (PDF, chunk IDs) ensures MCP searches real content, not ghosts.
3. **Phase 4 before Phase 5** — Shared `buildMcpServer()` proven on stdio before adding SSE complexity.
4. **Phase 7 (auth)** — Does not fix data-plane pitfalls; only addresses exposure once core search path is verified.

## Sources

- [MCP TypeScript SDK — server quickstart (stderr logging)](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server-quickstart.md) — HIGH
- [MCP TypeScript SDK — transport architecture (stdio, Streamable HTTP, SSE legacy)](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/CLAUDE.md) — HIGH
- [Chroma Cookbook — deployment patterns (embedded vs server, process safety)](https://cookbook.chromadb.dev/running/deployment-patterns/) — HIGH
- [ChromaDB persistence best practices](https://llmbestpractices.com/backend/chromadb-persistence) — MEDIUM
- [Chroma JS issue #5854 — explicit embedding function required](https://github.com/chroma-core/chroma/issues/5854) — HIGH
- [Albino Geek — 5 production MCP gotchas (stdout, concurrency, lifecycle)](https://www.albinogeek.com/posts/mcp-5-production-gotchas) — MEDIUM
- [MCP spec — pagination utilities](https://modelcontextprotocol.io/specification/2025-11-25/server/utilities/pagination) — HIGH
- [GitHub MCP discussion #2211 — oversized tool responses](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/2211) — MEDIUM
- [RAG fundamentals — scanned PDF failure mode](https://theneuralbase.com/rag-fundamentals/learn/beginner/why-scanned-pdfs-break-loading/) — MEDIUM
- [Embedding dimension mismatch — LlamaIndex course](https://theneuralbase.com/llamaindex/learn/beginner/embedding-dimension-mismatch/) — MEDIUM
- [Retrieval cascade failure — document deletion / orphan chunks](https://tianpan.co/blog/2026-05-09-retrieval-cascade-failure-document-deletion-rag) — MEDIUM
- [NVIDIA RAG MCP blueprint — thin adapter, ingest via separate API](https://docs.nvidia.com/rag/latest/mcp.html) — MEDIUM
- [MODULAR-RAG-MCP-SERVER — rate limiting, dimension mismatch on provider switch](https://github.com/nobitalqs/MODULAR-RAG-MCP-SERVER) — LOW (pattern reference)

---
*Pitfalls research for: kb-mcp-server (knowledge-base MCP + vector RAG scaffold)*
*Researched: 2026-06-29*
