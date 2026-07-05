import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import BetterSqlite3 from "better-sqlite3";
import type { AppConfig } from "@kb/config";
import type { ChunkConfig, ContextConfig } from "./types.js";
import { runRegistryMigrations } from "./migrations.js";

function loadSchemaSql(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(dir, "schema.sql"), "utf-8");
}

function migrateSettingsColumns(db: Database.Database): void {
  const columns = db
    .prepare("PRAGMA table_info(settings)")
    .all() as { name: string }[];
  const names = new Set(columns.map((c) => c.name));

  const additions: [string, number][] = [
    ["read_around_window_default", 1],
    ["read_around_window_max", 3],
    ["read_around_max_chars", 32000],
    ["read_file_max_chunks", 50],
    ["read_file_max_chars", 64000],
  ];

  for (const [col, defaultVal] of additions) {
    if (!names.has(col)) {
      db.exec(
        `ALTER TABLE settings ADD COLUMN ${col} INTEGER NOT NULL DEFAULT ${defaultVal}`,
      );
    }
  }
}

function ensureSchema(db: Database.Database): void {
  db.exec(loadSchemaSql());
  migrateSettingsColumns(db);
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
        read_around_max_chars, read_file_max_chunks, read_file_max_chars
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      config.CHUNK_SIZE,
      config.CHUNK_OVERLAP,
      config.READ_AROUND_WINDOW_DEFAULT,
      config.READ_AROUND_WINDOW_MAX,
      config.READ_AROUND_MAX_CHARS,
      config.READ_FILE_MAX_CHUNKS,
      config.READ_FILE_MAX_CHARS,
    );
  }
}

export interface SettingsStore {
  db: Database.Database;
  getChunkConfig(): ChunkConfig;
  getContextConfig(): ContextConfig;
  updateContextConfig(patch: Partial<ContextConfig>): ContextConfig;
}

export function getSettingsStore(
  dbPath: string,
  config: AppConfig,
  options?: { systemUserId?: string },
): SettingsStore {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  ensureSchema(db);
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
