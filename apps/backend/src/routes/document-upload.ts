import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { unlink } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";
import type { FastifyRequest, FastifyReply } from "fastify";
import type { IngestionService } from "@kb/core";
import { mapIngestError } from "../lib/errors.js";

const ALLOWED_MIME = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".pdf",
]);

export function isAllowedUpload(filename: string, mimetype: string): boolean {
  const ext = extname(filename).toLowerCase();
  return ALLOWED_MIME.has(mimetype) && ALLOWED_EXTENSIONS.has(ext);
}

export function toPublicDocument<T extends { sourcePath: string }>(
  doc: T,
): Omit<T, "sourcePath"> {
  const { sourcePath: _sourcePath, ...rest } = doc;
  return rest;
}

export interface IngestUploadParams {
  ingestionService: IngestionService;
  uploadsDir: string;
  defaultCollection: string;
  userId: string;
}

export async function ingestMultipartUpload(
  request: FastifyRequest,
  reply: FastifyReply,
  params: IngestUploadParams,
): Promise<unknown> {
  let collection: string | undefined;
  let tempPath: string | undefined;
  let originalFilename: string | undefined;

  const parts = request.parts();
  for await (const part of parts) {
    if (part.type === "field" && part.fieldname === "collection") {
      collection = String(part.value);
    } else if (part.type === "file") {
      originalFilename = basename(part.filename);
      if (!isAllowedUpload(part.filename, part.mimetype)) {
        return reply.code(415).send({
          error: "unsupported_media_type",
          message: `Unsupported: ${part.mimetype}`,
        });
      }

      tempPath = join(
        params.uploadsDir,
        `${randomUUID()}-${basename(part.filename)}`,
      );
      await mkdir(params.uploadsDir, { recursive: true });
      await pipeline(part.file, createWriteStream(tempPath));
    }
  }

  if (!tempPath) {
    return reply.code(400).send({
      error: "bad_request",
      message: "Missing file field",
    });
  }

  try {
    const result = await params.ingestionService.ingest(tempPath, {
      collection: collection ?? params.defaultCollection,
      filename: originalFilename,
      userId: params.userId,
    });
    await unlink(tempPath).catch(() => {});
    const statusCode = result.outcome === "created" ? 201 : 200;
    return reply.code(statusCode).send({
      documentId: result.documentId,
      chunkCount: result.chunkCount,
      collection: result.collection,
      status: "indexed",
      outcome: result.outcome,
    });
  } catch (error) {
    const mapped = mapIngestError(error);
    return reply.code(mapped.statusCode).send(mapped.body);
  }
}
