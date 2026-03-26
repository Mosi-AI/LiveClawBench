#!/usr/bin/env python3
import sqlite3
import sys
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS sources (
  source_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_url TEXT NOT NULL,
  reliability TEXT NOT NULL,
  kind TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS facts (
  fact_key TEXT PRIMARY KEY,
  fact_value TEXT NOT NULL,
  source_ids TEXT NOT NULL,
  confidence TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qa_answers (
  question_id TEXT PRIMARY KEY,
  answer TEXT NOT NULL,
  evidence_fact_key TEXT NOT NULL
);
"""


def main() -> int:
    target = Path(
        sys.argv[1]
        if len(sys.argv) > 1
        else "~/.openclaw/workspace/db/spec_decode_knowledge.db"
    ).expanduser()
    target.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(target)
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()
    print(target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
