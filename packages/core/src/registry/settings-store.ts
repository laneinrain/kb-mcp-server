import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import BetterSqlite3 from "better-sqlite3";
import type { AppConfig } from "@kb/config";
import type { ChunkConfig } from "./types.js";

function loadSchemaSql(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(join(dir, "schema.sql"), "utf-8");
}

function ensureSchema(db: Database.Database): void {
  db.exec(loadSchemaSql());
}

function seedSettingsIfMissing(db: Database.Database, config: AppConfig): void {
  const existing = db
    .prepare("SELECT 1 AS found FROM settings WHERE id = 1")
    .get();

  if (!existing) {
    db.prepare(
      "INSERT INTO settings (id, chunk_size, chunk_overlap) VALUES (1, ?, ?)",
    ).run(config.CHUNK_SIZE, config.CHUNK_OVERLAP);
  }
}

export interface SettingsStore {
  db: Database.Database;
  getChunkConfig(): ChunkConfig;
}

export function getSettingsStore(
  dbPath: string,
  config: AppConfig,
): SettingsStore {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new BetterSqlite3(dbPath);
  ensureSchema(db);
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
  };
}

let activeStore: SettingsStore | null = null;

export function initSettingsStore(config: AppConfig): SettingsStore {
  activeStore = getSettingsStore(config.SQLITE_PATH, config);
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
