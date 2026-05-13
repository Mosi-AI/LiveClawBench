BEGIN;

CREATE TABLE metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO metadata (key, value) VALUES
  ('site_title', 'Speculative Decoding Browser Portal'),
  ('home_title', 'Speculative Decoding Evidence Portal'),
  ('home_description', 'Search this local portal for validated follow-up notes, benchmarks, and superseded claims about speculative decoding.'),
  ('search_placeholder', 'Search for exact decoding, speedup condition, self speculative decoding');

CREATE TABLE query_examples (
  position INTEGER PRIMARY KEY,
  query TEXT NOT NULL
);

INSERT INTO query_examples (position, query) VALUES
  (1, 'exact decoding cache only'),
  (2, 'high acceptance speedup condition'),
  (3, 'self speculative decoding draft model');

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
  'browser:spec_exact_001',
  'speculative-decoding-exact-not-cache-only',
  'Speculative Decoding Is Exact, Not Cache-Only',
  'research_note',
  'validated',
  'high',
  '2026-02-08',
  'inference-research',
  'The exactness guarantee comes from target verification, so the method should not be reduced to cache warming.',
  'Speculative decoding remains exact because the target model verifies the drafted tokens before commitment.\n\nThat makes the method fundamentally different from a cache-only shortcut.\n\nA cache metaphor may help as intuition, but it is not the durable technical description.',
  'speculative decoding | exact | verification | cache'
);

INSERT INTO documents (id, slug, title, kind, status, reliability, updated_at, owner, summary, body, tags) VALUES (
  'browser:spec_perf_002',
  'speculative-decoding-speedup-condition',
  'Why High Acceptance Is Not Enough',
  'benchmark_note',
  'validated',
  'high',
  '2026-02-12',
  'serving-benchmarks',
  'The practical speedup depends on draft cost, acceptance, and system fit together.',
  'Teams reported that high acceptance alone was not enough to guarantee a speedup.\n\nIf draft cost is high or verification overhead dominates, the latency gain shrinks or disappears.\n\nThe durable condition is draft cost plus acceptance plus system fit, not acceptance alone.',
  'speculative decoding | acceptance | system fit | overhead'
);

INSERT INTO documents (id, slug, title, kind, status, reliability, updated_at, owner, summary, body, tags) VALUES (
  'browser:self_spec_003',
  'self-speculative-decoding-update',
  'Later Update: Separate Draft Model Not Always Required',
  'update_note',
  'validated',
  'high',
  '2026-02-17',
  'inference-research',
  'Self-speculative variants challenge the older claim that a separate draft model is always required.',
  'Later work shows that a separate draft model is not always required.\n\nSelf-speculative decoding can reuse part of the same model or a partial pass as the drafter while keeping target verification in place.\n\nThe old absolute requirement should therefore be repaired.',
  'speculative decoding | self speculative | draft model'
);

INSERT INTO documents (id, slug, title, kind, status, reliability, updated_at, owner, summary, body, tags) VALUES (
  'browser:spec_noise_001',
  'cache-only-marketing-shortcut',
  'Cache-Only Marketing Shortcut',
  'marketing_post',
  'promotional',
  'low',
  '2025-12-04',
  'marketing',
  'Treat speculative decoding as cache warmup and stop thinking about exactness.',
  'This post deliberately drops the verification story and should not be used as durable evidence.',
  'speculative decoding | cache | marketing'
);

INSERT INTO documents (id, slug, title, kind, status, reliability, updated_at, owner, summary, body, tags) VALUES (
  'browser:spec_noise_002',
  'universal-speedup-claim',
  'Universal Speedup Claim',
  'legacy_note',
  'superseded',
  'low',
  '2025-09-14',
  'legacy-serving',
  'Once acceptance is high, speculative decoding is just faster.',
  'This note predates the later benchmark analysis and overstates the deployment condition.',
  'speculative decoding | acceptance | speedup | superseded'
);

COMMIT;
