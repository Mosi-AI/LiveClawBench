#!/usr/bin/env python3
import argparse
import sqlite3
from pathlib import Path

from init_spec_decode_db import SCHEMA


def ensure_db(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Small helper for creating or updating the speculative-decoding reference DB."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    init_p = sub.add_parser("init", help="create the DB schema if it does not exist")
    init_p.add_argument("db_path", nargs="?", default="db/spec_decode_knowledge.db")

    source_p = sub.add_parser("add-source", help="insert or replace one source row")
    source_p.add_argument("db_path")
    source_p.add_argument("source_id")
    source_p.add_argument("title")
    source_p.add_argument("source_url")
    source_p.add_argument("reliability")
    source_p.add_argument("kind")

    fact_p = sub.add_parser("add-fact", help="insert or replace one fact row")
    fact_p.add_argument("db_path")
    fact_p.add_argument("fact_key")
    fact_p.add_argument("fact_value")
    fact_p.add_argument("source_ids", help="comma-separated source ids")
    fact_p.add_argument("confidence")

    answer_p = sub.add_parser("add-answer", help="insert or replace one qa_answers row")
    answer_p.add_argument("db_path")
    answer_p.add_argument("question_id")
    answer_p.add_argument("answer")
    answer_p.add_argument("evidence_fact_key")

    schema_p = sub.add_parser("show-schema", help="print the current schema")
    schema_p.add_argument("db_path", nargs="?", default="db/spec_decode_knowledge.db")

    return parser.parse_args()


def main() -> int:
    args = parse_args()
    db_path = Path(getattr(args, "db_path", "db/spec_decode_knowledge.db"))

    if args.command == "init":
        conn = ensure_db(db_path)
        conn.close()
        print(db_path)
        return 0

    conn = ensure_db(db_path)
    try:
        if args.command == "add-source":
            conn.execute(
                """
                INSERT OR REPLACE INTO sources (source_id, title, source_url, reliability, kind)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    args.source_id,
                    args.title,
                    args.source_url,
                    args.reliability,
                    args.kind,
                ),
            )
        elif args.command == "add-fact":
            conn.execute(
                """
                INSERT OR REPLACE INTO facts (fact_key, fact_value, source_ids, confidence)
                VALUES (?, ?, ?, ?)
                """,
                (args.fact_key, args.fact_value, args.source_ids, args.confidence),
            )
        elif args.command == "add-answer":
            conn.execute(
                """
                INSERT OR REPLACE INTO qa_answers (question_id, answer, evidence_fact_key)
                VALUES (?, ?, ?)
                """,
                (args.question_id, args.answer, args.evidence_fact_key),
            )
        elif args.command == "show-schema":
            rows = conn.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
            ).fetchall()
            for (sql,) in rows:
                if sql:
                    print(sql)
            return 0
        conn.commit()
    finally:
        conn.close()

    print(db_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
