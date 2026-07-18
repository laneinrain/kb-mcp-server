/**
 * Local OpenAI-compatible mock for embeddings + rerank.
 * Used for full-stack verification when no real CHERRYIN_API_KEY is available.
 *
 * Endpoints (base URL should end with /v1):
 *   POST /v1/embeddings  (supports encoding_format=float|base64)
 *   POST /v1/rerank
 */
import { createHash } from "node:crypto";
import http from "node:http";

const PORT = Number(process.env.MOCK_CHERRYIN_PORT ?? 8765);
const DIM = Number(process.env.EMBEDDING_DIMENSIONS ?? 1024);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Deterministic bag-of-tokens embedding in R^DIM (L2-normalized). */
function embedText(text: string, dims: number): number[] {
  const vec = new Float64Array(dims);
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    tokens.push("empty");
  }
  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    for (let i = 0; i < 8; i++) {
      const idx = digest.readUInt16BE((i * 2) % 32) % dims;
      const sign = digest[i]! & 1 ? 1 : -1;
      vec[idx]! += sign;
    }
  }
  let norm = 0;
  for (let i = 0; i < dims; i++) norm += vec[i]! * vec[i]!;
  norm = Math.sqrt(norm) || 1;
  const out: number[] = new Array(dims);
  for (let i = 0; i < dims; i++) out[i] = vec[i]! / norm;
  return out;
}

function toBase64Float32(values: number[]): string {
  const buf = Buffer.alloc(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    buf.writeFloatLE(values[i]!, i * 4);
  }
  return buf.toString("base64");
}

function overlapScore(query: string, doc: string): number {
  const q = new Set(tokenize(query));
  const d = tokenize(doc);
  if (q.size === 0 || d.length === 0) return 0;
  let hit = 0;
  for (const t of d) if (q.has(t)) hit += 1;
  return hit / Math.sqrt(q.size * d.length);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? "/";
  if (req.method === "GET" && (url === "/" || url === "/health")) {
    sendJson(res, 200, { status: "ok", mock: true });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" });
    return;
  }

  let raw: string;
  try {
    raw = await readBody(req);
  } catch {
    sendJson(res, 400, { error: "bad_request" });
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    sendJson(res, 400, { error: "invalid_json" });
    return;
  }

  if (url === "/v1/embeddings" || url === "/embeddings") {
    const input = body.input;
    const inputs = Array.isArray(input)
      ? input.map(String)
      : [String(input ?? "")];
    const dims =
      typeof body.dimensions === "number" && body.dimensions > 0
        ? body.dimensions
        : DIM;
    // OpenAI Node SDK defaults encoding_format to base64 and decodes client-side.
    const encoding =
      body.encoding_format === "float" ? "float" : "base64";
    const data = inputs.map((text, index) => {
      const embedding = embedText(text, dims);
      return {
        object: "embedding",
        index,
        embedding:
          encoding === "base64" ? toBase64Float32(embedding) : embedding,
      };
    });
    console.log(
      `[mock-cherryin] embeddings n=${inputs.length} dims=${dims} encoding=${encoding}`,
    );
    sendJson(res, 200, {
      object: "list",
      data,
      model: String(body.model ?? "mock-embedding"),
      usage: { prompt_tokens: 0, total_tokens: 0 },
    });
    return;
  }

  if (url === "/v1/rerank" || url === "/rerank") {
    const query = String(body.query ?? "");
    const documents = Array.isArray(body.documents)
      ? body.documents.map(String)
      : [];
    const scored = documents
      .map((doc, index) => ({
        index,
        relevance_score: overlapScore(query, doc),
      }))
      .sort((a, b) => b.relevance_score - a.relevance_score);
    const topN =
      typeof body.top_n === "number" ? body.top_n : scored.length;
    sendJson(res, 200, { results: scored.slice(0, topN) });
    return;
  }

  sendJson(res, 404, { error: "not_found", path: url });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-cherryin] listening on http://127.0.0.1:${PORT}/v1`);
});
