import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import BetterSqlite3 from "better-sqlite3";
import type { AppConfig } from "@kb/config";
import type { ChunkConfig, ContextConfig, ModelConfig } from "./types.js";
import { runRegistryMigrations } from "./migrations.js";

const RERANK_CANDIDATES_MIN = 1;
const RERANK_CANDIDATES_MAX = 50;

function loadSchemaSql(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(dir, "schema.sql"), "utf-8");
}

function sqlStringLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function migrateSettingsColumns(db: Database.Database, config: AppConfig): void {
  const columns = db
    .prepare("PRAGMA table_info(settings)")
    .all() as { name: string }[];
  const names = new Set(columns.map((c) => c.name));

  const integerAdditions: [string, number][] = [
    ["read_around_window_default", 1],
    ["read_around_window_max", 3],
    ["read_around_max_chars", 32000],
    ["read_file_max_chunks", 50],
    ["read_file_max_chars", 64000],
    ["rerank_enabled", config.RERANK_ENABLED ? 1 : 0],
    ["rerank_candidates", config.RERANK_CANDIDATES],
  ];

  for (const [col, defaultVal] of integerAdditions) {
    if (!names.has(col)) {
      db.exec(
        `ALTER TABLE settings ADD COLUMN ${col} INTEGER NOT NULL DEFAULT ${defaultVal}`,
      );
    }
  }

  const textAdditions: [string, string][] = [
    ["embedding_model", config.EMBEDDING_MODEL],
    ["rerank_model", config.RERANK_MODEL],
  ];

  for (const [col, defaultVal] of textAdditions) {
    if (!names.has(col)) {
      db.exec(
        `ALTER TABLE settings ADD COLUMN ${col} TEXT NOT NULL DEFAULT ${sqlStringLiteral(defaultVal)}`,
      );
    }
  }
}

function ensureSchema(db: Database.Database, config: AppConfig): void {
  db.exec(loadSchemaSql());
  migrateSettingsColumns(db, config);
}

function seedSettingsIfMissing(db: Database.Database, config: AppConfig): void {
  const existing = db
    .prepare("SELECT 1 AS found FROM settings WHERE id = 1")
    .get();

  if (!existing) {
    db.prepare(
      `INSERT INTO settings (
        id, chunk_size, chunk_overlap,
        read_around_window_default, read_around_window_max,
        read_around_max_chars, read_file_max_chunks, read_file_max_chars,
        embedding_model, rerank_enabled, rerank_model, rerank_candidates
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      config.CHUNK_SIZE,
      config.CHUNK_OVERLAP,
      config.READ_AROUND_WINDOW_DEFAULT,
      config.READ_AROUND_WINDOW_MAX,
      config.READ_AROUND_MAX_CHARS,
      config.READ_FILE_MAX_CHUNKS,
      config.READ_FILE_MAX_CHARS,
      config.EMBEDDING_MODEL,
      config.RERANK_ENABLED ? 1 : 0,
      config.RERANK_MODEL,
      config.RERANK_CANDIDATES,
    );
  }
}

function normalizeModelConfig(input: ModelConfig): ModelConfig {
  const embeddingModel = input.embeddingModel.trim();
  const rerankModel = input.rerankModel.trim();

  if (!embeddingModel) {
    throw new Error("embeddingModel must be a non-empty string");
  }
  if (!rerankModel) {
    throw new Error("rerankModel must be a non-empty string");
  }
  if (
    !Number.isInteger(input.rerankCandidates) ||
    input.rerankCandidates < RERANK_CANDIDATES_MIN ||
    input.rerankCandidates > RERANK_CANDIDATES_MAX
  ) {
    throw new Error(
      `rerankCandidates must be an integer between ${RERANK_CANDIDATES_MIN} and ${RERANK_CANDIDATES_MAX}`,
    );
  }

  return {
    embeddingModel,
    rerankEnabled: input.rerankEnabled,
    rerankModel,
    rerankCandidates: input.rerankCandidates,
  };
}

export interface SettingsStore {
  db: Database.Database;
  getChunkConfig(): ChunkConfig;
  getContextConfig(): ContextConfig;
  updateContextConfig(patch: Partial<ContextConfig>): ContextConfig;
  getModelConfig(): ModelConfig;
  updateModelConfig(patch: Partial<ModelConfig>): ModelConfig;
}

export function getSettingsStore(
  dbPath: string,
  config: AppConfig,
  options?: { systemUserId?: string },
): SettingsStore {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  ensureSchema(db, config);
  runRegistryMigrations(db, options?.systemUserId ?? "");
  seedSettingsIfMissing(db, config);

  return {
    db,
    getChunkConfig(): ChunkConfig {
      return db
        .prepare(
          "SELECT chunk_size AS chunkSize, chunk_overlap AS chunkOverlap FROM settings WHERE id = 1",
        )
        .get() as ChunkConfig;
    },
    getContextConfig(): ContextConfig {
      return db
        .prepare(
          `SELECT
            read_around_window_default AS readAroundWindowDefault,
            read_around_window_max AS readAroundWindowMax,
            read_around_max_chars AS readAroundMaxChars,
            read_file_max_chunks AS readFileMaxChunks,
            read_file_max_chars AS readFileMaxChars
          FROM settings WHERE id = 1`,
        )
        .get() as ContextConfig;
    },
    updateContextConfig(patch: Partial<ContextConfig>): ContextConfig {
      const current = this.getContextConfig();
      const updated: ContextConfig = { ...current, ...patch };

      if (updated.readAroundWindowMax < updated.readAroundWindowDefault) {
        throw new Error(
          "readAroundWindowMax must be >= readAroundWindowDefault",
        );
      }

      db.prepare(
        `UPDATE settings SET
          read_around_window_default = ?,
          read_around_window_max = ?,
          read_around_max_chars = ?,
          read_file_max_chunks = ?,
          read_file_max_chars = ?
        WHERE id = 1`,
      ).run(
        updated.readAroundWindowDefault,
        updated.readAroundWindowMax,
        updated.readAroundMaxChars,
        updated.readFileMaxChunks,
        updated.readFileMaxChars,
      );

      return updated;
    },
    getModelConfig(): ModelConfig {
      const row = db
        .prepare(
          `SELECT
            embedding_model AS embeddingModel,
            rerank_enabled AS rerankEnabled,
            rerank_model AS rerankModel,
            rerank_candidates AS rerankCandidates
          FROM settings WHERE id = 1`,
        )
        .get() as {
        embeddingModel: string;
        rerankEnabled: number;
        rerankModel: string;
        rerankCandidates: number;
      };

      return {
        embeddingModel: row.embeddingModel,
        rerankEnabled: row.rerankEnabled === 1,
        rerankModel: row.rerankModel,
        rerankCandidates: row.rerankCandidates,
      };
    },
    updateModelConfig(patch: Partial<ModelConfig>): ModelConfig {
      const updated = normalizeModelConfig({
        ...this.getModelConfig(),
        ...patch,
      });

      db.prepare(
        `UPDATE settings SET
          embedding_model = ?,
          rerank_enabled = ?,
          rerank_model = ?,
          rerank_candidates = ?
        WHERE id = 1`,
      ).run(
        updated.embeddingModel,
        updated.rerankEnabled ? 1 : 0,
        updated.rerankModel,
        updated.rerankCandidates,
      );

      return updated;
    },
  };
}

let activeStore: SettingsStore | null = null;

export function initSettingsStore(
  config: AppConfig,
  options?: { systemUserId?: string },
): SettingsStore {
  activeStore = getSettingsStore(config.SQLITE_PATH, config, options);
  return activeStore;
}

export function getChunkConfig(): ChunkConfig {
  if (!activeStore) {
    throw new Error(
      "Settings store not initialized. Call initSettingsStore() first.",
    );
  }
  return activeStore.getChunkConfig();
}

export function getContextConfig(): ContextConfig {
  if (!activeStore) {
    throw new Error(
      "Settings store not initialized. Call initSettingsStore() first.",
    );
  }
  return activeStore.getContextConfig();
}

export function getModelConfig(): ModelConfig {
  if (!activeStore) {
    throw new Error(
      "Settings store not initialized. Call initSettingsStore() first.",
    );
  }
  return activeStore.getModelConfig();
}
