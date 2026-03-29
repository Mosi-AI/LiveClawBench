#!/usr/bin/env python3
import os
import shutil
from pathlib import Path


def resolve_root() -> Path:
    raw = os.environ.get("OPENCLAW_WORKSPACE_ROOT") or os.environ.get(
        "CASE_RUNTIME_ROOT"
    )
    if raw:
        if raw.startswith("~"):
            return Path(raw).expanduser()
        return Path(raw)
    return Path.home() / ".openclaw"


ROOT = resolve_root()
WORK = ROOT / "workspace"
OUT = ROOT / "output"

SYSTEM_ROOT_FILES = {
    "AGENTS.md",
    "BOOTSTRAP.md",
    "HEARTBEAT.md",
    "IDENTITY.md",
    "REQUEST.md",
    "SOUL.md",
    "TOOLS.md",
    "USER.md",
}


def read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def workspace_relpath(path: Path) -> Path:
    return path.resolve().relative_to(WORK.resolve())


def seed_workspace_root() -> Path | None:
    candidate = Path("/task/workspace")
    if candidate.is_dir():
        return candidate
    return None


def is_durable_note(path: Path) -> bool:
    if not path.is_file() or path.suffix != ".md" or path.stat().st_size <= 0:
        return False
    try:
        rel = workspace_relpath(path)
    except ValueError:
        return False
    if rel.parts and rel.parts[0] in {"corpus", "output"}:
        return False
    if path.parent == WORK and path.name in SYSTEM_ROOT_FILES:
        return False
    return True


def is_modified_from_seed(path: Path) -> bool:
    seed_root = seed_workspace_root()
    if seed_root is None:
        return True
    rel = workspace_relpath(path)
    seed_path = seed_root / rel
    if not seed_path.exists():
        return True
    return read_text(path) != read_text(seed_path)


def candidate_notes() -> list[Path]:
    candidates: list[Path] = []
    for path in sorted(WORK.glob("*.md")):
        if is_durable_note(path) and is_modified_from_seed(path):
            candidates.append(path)
    for subdir in ("memory", "state", "notes"):
        root = WORK / subdir
        if not root.is_dir():
            continue
        for path in sorted(root.glob("*.md")):
            if is_durable_note(path) and is_modified_from_seed(path):
                candidates.append(path)
    return candidates


def main() -> None:
    if any(
        (OUT / name).is_file() and read_text(OUT / name).strip()
        for name in ("summary.md", "final.md", "answer.md")
    ):
        return

    candidates = candidate_notes()
    if not candidates:
        return

    best = max(
        candidates,
        key=lambda path: (path.stat().st_mtime, len(read_text(path).strip())),
    )
    OUT.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(best, OUT / "final.md")


if __name__ == "__main__":
    main()
