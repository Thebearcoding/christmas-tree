-- D1 migration: shared memory tree documents
CREATE TABLE IF NOT EXISTS shares (
  share_id TEXT PRIMARY KEY,
  doc_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

