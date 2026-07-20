CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  chunk_size INTEGER NOT NULL,
  chunk_overlap INTEGER NOT NULL,
  read_around_window_default INTEGER NOT NULL DEFAULT 1,
  read_around_window_max INTEGER NOT NULL DEFAULT 3,
  read_around_max_chars INTEGER NOT NULL DEFAULT 32000,
  read_file_max_chunks INTEGER NOT NULL DEFAULT 50,
  read_file_max_chars INTEGER NOT NULL DEFAULT 64000,
  embedding_model TEXT NOT NULL DEFAULT 'qwen/qwen3-embedding-8b',
  rerank_enabled INTEGER NOT NULL DEFAULT 1,
  rerank_model TEXT NOT NULL DEFAULT 'qwen/qwen3-reranker-0.6b',
  rerank_candidates INTEGER NOT NULL DEFAULT 30
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  source_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  status TEXT NOT NULL,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  collection TEXT NOT NULL,
  user_id TEXT,
  content_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS document_chunks (
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chroma_id TEXT NOT NULL,
  PRIMARY KEY (document_id, chunk_index),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
