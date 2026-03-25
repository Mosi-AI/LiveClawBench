#!/usr/bin/env python3
import argparse
import os
import sys
from pathlib import Path


def nonempty_text(path: Path) -> bool:
    if not path.is_file():
        return False
    try:
        return bool(path.read_text(encoding="utf-8").strip())
    except OSError:
        return False


def workspace_root_notes(workspace: Path):
    ignored = {
        "AGENTS.md",
        "BOOTSTRAP.md",
        "HEARTBEAT.md",
        "IDENTITY.md",
        "MEMORY.md",
        "SOUL.md",
        "TOOLS.md",
        "USER.md",
    }
    for candidate in workspace.glob("*.md"):
        if candidate.name in ignored:
            continue
        if candidate.is_file():
            yield candidate


def has_answer_artifact(output: Path) -> bool:
    for name in ("summary.md", "final.md", "answer.md"):
        if nonempty_text(output / name):
            return True
    return False


def has_durable_state(workspace: Path) -> bool:
    for candidate in (workspace / "MEMORY.md",):
        if nonempty_text(candidate):
            return True

    for candidate in workspace_root_notes(workspace):
        if nonempty_text(candidate):
            return True

    for subdir in ("memory", "state", "notes"):
        root = workspace / subdir
        if not root.is_dir():
            continue
        for candidate in root.glob("*.md"):
            if nonempty_text(candidate):
                return True
    return False


def has_database(workspace: Path) -> bool:
    db_dir = workspace / "db"
    if not db_dir.is_dir():
        return False
    for pattern in ("*.sqlite", "*.db"):
        if any(path.is_file() for path in db_dir.glob(pattern)):
            return True
    return False


def has_browser_mock_log(output: Path) -> bool:
    path = output / "browser_mock_access.jsonl"
    return path.is_file() and path.stat().st_size >= 0


def has_browser_any_log(output: Path) -> bool:
    for name in (
        "browser_requests.json",
        "browser_tabs.json",
        "browser_trace.zip",
        "browser_mock_access.jsonl",
    ):
        path = output / name
        if path.is_file() and path.stat().st_size > 0:
            return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--root",
        default=os.environ.get(
            "OPENCLAW_WORKSPACE_ROOT", str(Path.home() / ".openclaw")
        ),
    )
    parser.add_argument("--require-result", action="store_true")
    parser.add_argument("--require-db", action="store_true")
    parser.add_argument("--require-browser-mock", action="store_true")
    parser.add_argument("--require-browser-any", action="store_true")
    args = parser.parse_args()

    root = Path(args.root)
    output = root / "output"
    workspace = root / "workspace"

    if args.require_result:
        checks = [
            ((output / "result.json").is_file(), "missing output/result.json"),
            (has_durable_state(workspace), "missing durable workspace state"),
        ]
    else:
        checks = [
            (
                has_answer_artifact(output),
                "missing output/summary.md, output/final.md, or output/answer.md",
            ),
            (has_durable_state(workspace), "missing durable workspace state"),
        ]

    if args.require_db:
        checks.append(
            (has_database(workspace), "missing workspace/db/*.db or *.sqlite")
        )
    if args.require_browser_mock:
        checks.append(
            (has_browser_mock_log(output), "missing output/browser_mock_access.jsonl")
        )
    if args.require_browser_any:
        checks.append((has_browser_any_log(output), "missing browser activity log"))

    failures = [message for ok, message in checks if not ok]
    if failures:
        for message in failures:
            print(message, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
