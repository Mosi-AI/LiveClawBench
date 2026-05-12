BEGIN;

CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO metadata (key, value) VALUES
  ('site_title', 'Test Portal'),
  ('home_title', 'Test Home'),
  ('home_description', 'A minimal test portal for contract testing.');

CREATE TABLE query_examples (
  position INTEGER PRIMARY KEY,
  query TEXT NOT NULL
);

INSERT INTO query_examples (position, query) VALUES
  (1, 'test query');

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  reliability TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  owner TEXT NOT NULL,
  summary TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL
);

CREATE VIRTUAL TABLE documents_fts USING fts5(
  title,
  summary,
  body,
  tags,
  content='documents',
  content_rowid='rowid',
  tokenize='porter unicode61'
);

CREATE TRIGGER documents_ai AFTER INSERT ON documents BEGIN
  INSERT INTO documents_fts(rowid, title, summary, body, tags)
  VALUES (new.rowid, new.title, new.summary, new.body, new.tags);
END;

INSERT INTO documents (id, slug, title, kind, status, reliability, updated_at, owner, summary, body, tags) VALUES (
  'test:doc_001',
  'test-document',
  'Test Document',
  'research_note',
  'validated',
  'high',
  '2026-01-01',
  'test-owner',
  'A short summary for testing.',
  'This is the body of the test document used for contract testing.',
  'test | contract'
);

COMMIT;
