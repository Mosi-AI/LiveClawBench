#!/usr/bin/env python3
import argparse
import json
import os
import sqlite3
from pathlib import Path

SYSTEM_ROOT_FILES = {
    "AGENTS.md",
    "BOOTSTRAP.md",
    "HEARTBEAT.md",
    "IDENTITY.md",
    "SOUL.md",
    "TOOLS.md",
    "USER.md",
}

REQUIRED_EVIDENCE_IDS = {
    "browser:spec_exact_001",
    "browser:self_spec_002",
    "browser:spec_speed_003",
    "browser:uad_004",
}

LOW_CONFIDENCE_IDS = {
    "browser:spec_noise_001",
    "browser:spec_noise_002",
}


def resolve_root(raw: str | None) -> Path:
    if raw:
        return Path(raw).expanduser() if raw.startswith("~") else Path(raw)
    return Path.home() / ".openclaw"


def workspace_relpath(path: Path, work: Path) -> str | None:
    try:
        rel = path.resolve().relative_to(work.resolve())
    except ValueError:
        return None
    return rel.as_posix()


def choose_artifact(work: Path, explicit: str | None) -> str | None:
    if explicit:
        candidate = (work / explicit).resolve()
        if candidate.is_file():
            rel = workspace_relpath(candidate, work)
            if rel:
                return rel

    preferred = work / "memory" / "speculative_decoding_reference.md"
    if preferred.is_file():
        rel = workspace_relpath(preferred, work)
        if rel:
            return rel

    candidates = []
    for root in (work, work / "memory", work / "notes", work / "state"):
        if not root.exists():
            continue
        for path in sorted(root.glob("*.md")):
            if path.parent == work and path.name in SYSTEM_ROOT_FILES:
                continue
            if path.is_file() and path.stat().st_size > 0:
                candidates.append(path)
    if not candidates:
        return None
    best = max(candidates, key=lambda p: (p.stat().st_mtime, p.stat().st_size))
    return workspace_relpath(best, work)


def load_events(path: Path | None) -> list[dict]:
    if path is None or not path.exists():
        return []
    events = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            events.append(payload)
    return events


def resolve_browser_log(root: Path, requested: str | None) -> Path | None:
    candidates: list[Path] = []
    if requested:
        candidate = Path(requested)
        if not candidate.is_absolute():
            candidate = root / requested
        candidates.append(candidate)
    env_path = os.environ.get("BROWSER_MOCK_ACCESS_LOG")
    if env_path:
        candidates.append(Path(env_path))
    candidates.append(root / "output" / "browser_mock_access.jsonl")
    candidates.append(Path("/shared/browser_mock_access.jsonl"))

    seen: set[Path] = set()
    for candidate in candidates:
        if candidate in seen:
            continue
        seen.add(candidate)
        if candidate.is_file() and candidate.stat().st_size > 0:
            return candidate
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    return None


def db_state(db_path: Path) -> dict:
    if not db_path.exists():
        return {"exists": False}
    try:
        conn = sqlite3.connect(db_path)
    except sqlite3.Error:
        return {"exists": False}
    try:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
        }
        return {"exists": True, "tables": sorted(tables)}
    finally:
        conn.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--workspace-root", default=os.environ.get("OPENCLAW_WORKSPACE_ROOT")
    )
    parser.add_argument("--artifact", default=None)
    parser.add_argument("--db-path", default="db/spec_decode_knowledge.db")
    parser.add_argument("--browser-log", default="output/browser_mock_access.jsonl")
    parser.add_argument("--require-browser", action="store_true")
    args = parser.parse_args()

    root = resolve_root(args.workspace_root)
    work = root / "workspace"
    output = root / "output"
    artifact = choose_artifact(work, args.artifact)
    browser_log = resolve_browser_log(root, args.browser_log)
    events = load_events(browser_log)
    page_ids = {
        str(event.get("doc_id", "")).strip()
        for event in events
        if event.get("event") in {"click", "page"}
    }
    searches = sum(1 for event in events if event.get("event") == "search")
    rejected_seen = sorted(page_ids & LOW_CONFIDENCE_IDS)

    summary = {
        "artifact": artifact,
        "browser_log": str(browser_log) if browser_log else "",
        "search_count": searches,
        "required_evidence_present": sorted(page_ids & REQUIRED_EVIDENCE_IDS),
        "rejected_evidence_present": rejected_seen,
        "db_state": db_state(work / args.db_path),
        "result_exists": (output / "result.json").is_file(),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))

    if not artifact:
        return 1
    if args.require_browser and not REQUIRED_EVIDENCE_IDS.issubset(page_ids):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
