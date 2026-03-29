#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

QUESTION_KEYS = [
    "exactness_guarantee",
    "draft_requirement_status",
    "tokenizer_requirement_status",
    "speedup_condition",
    "fallback_reason",
    "self_spec_definition",
    "deployment_regime",
]


def parse_answer(raw: str) -> tuple[str, str]:
    if "=" not in raw:
        raise argparse.ArgumentTypeError("answers must use key=value form")
    key, value = raw.split("=", 1)
    key = key.strip()
    value = value.strip()
    if not key or not value:
        raise argparse.ArgumentTypeError("answers must use non-empty key=value form")
    return key, value


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Write the structured result.json artifact for the hybrid tool-memory case."
    )
    parser.add_argument(
        "output_path", nargs="?", default="~/.openclaw/output/result.json"
    )
    parser.add_argument("--task-id", default="pkb_hybrid_tool_memory_hard_001")
    parser.add_argument("--topic-id", default="speculative_decoding")
    parser.add_argument("--db-path", default="db/spec_decode_knowledge.db")
    parser.add_argument("--used-local-source-id", action="append", default=[])
    parser.add_argument("--retrieved-evidence-id", action="append", default=[])
    parser.add_argument("--rejected-evidence-id", action="append", default=[])
    parser.add_argument("--updated-artifact", action="append", default=[])
    parser.add_argument("--answer", action="append", type=parse_answer, default=[])
    args = parser.parse_args()

    answers = {key: "" for key in QUESTION_KEYS}
    for key, value in args.answer:
        answers[key] = value

    payload = {
        "task_id": args.task_id,
        "topic_id": args.topic_id,
        "db_path": args.db_path,
        "used_local_source_ids": args.used_local_source_id,
        "retrieved_evidence_ids": args.retrieved_evidence_id,
        "rejected_evidence_ids": args.rejected_evidence_id,
        "query_answers": answers,
        "updated_artifacts": args.updated_artifact,
    }

    output_path = Path(args.output_path).expanduser()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
