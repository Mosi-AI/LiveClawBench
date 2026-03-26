#!/usr/bin/env python3
import json
import os
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
LOCAL_SEED_WORK = Path(__file__).resolve().parents[1] / "environment" / "workspace_seed"

SYSTEM_ROOT_FILES = {
    "AGENTS.md",
    "BOOTSTRAP.md",
    "HEARTBEAT.md",
    "IDENTITY.md",
    "SOUL.md",
    "TOOLS.md",
    "USER.md",
}

INCORRECT_BELIEFS = {
    "speculative_is_cache_only": "speculative decoding is mostly cache warmup once the draft is in place",
    "high_acceptance_implies_general_speedup": "if acceptance is high, it should be generally faster",
    "separate_draft_model_always_required": "I still assume a separate draft model is always required",
}

CORRECTED_HINTS = {
    "exact_target_preserving_acceleration": ("exact", "verification", "target"),
    "draft_cost_acceptance_and_system_fit": ("acceptance", "draft", "throughput"),
    "separate_draft_not_always_required": (
        "self-speculative",
        "same model",
        "separate draft",
    ),
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
    for candidate in (Path("/task/workspace"), LOCAL_SEED_WORK):
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
    if not is_durable_note(path):
        return False
    seed_root = seed_workspace_root()
    if seed_root is None:
        return True
    rel = workspace_relpath(path)
    seed_path = seed_root / rel
    if not seed_path.exists():
        return True
    return read_text(path) != read_text(seed_path)


def modified_durable_artifacts() -> list[Path]:
    paths: list[Path] = []
    for candidate in sorted(WORK.glob("*.md")):
        if is_modified_from_seed(candidate):
            paths.append(candidate)
    for subdir in ("memory", "state", "notes"):
        root = WORK / subdir
        if not root.is_dir():
            continue
        for candidate in sorted(root.glob("*.md")):
            if is_modified_from_seed(candidate):
                paths.append(candidate)
    return paths


def best_memory_text() -> str:
    candidates = modified_durable_artifacts()
    if not candidates:
        return ""
    best = max(
        candidates,
        key=lambda path: (
            path.name == "MEMORY.md",
            path.stat().st_mtime,
            len(read_text(path)),
        ),
    )
    return read_text(best).strip()


def pick_line(text: str, hints: tuple[str, ...]) -> str:
    lines = [line.strip("- ").strip() for line in text.splitlines() if line.strip()]
    best = ""
    best_score = -1
    lowered_hints = tuple(h.lower() for h in hints)
    for line in lines:
        low = line.lower()
        score = sum(1 for hint in lowered_hints if hint in low)
        if score > best_score:
            best = line
            best_score = score
    return best


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    result_path = OUT / "result.json"
    if result_path.is_file() and result_path.stat().st_size > 0:
        return

    memory_text = best_memory_text()
    if not memory_text:
        return

    updated = [str(workspace_relpath(path)) for path in modified_durable_artifacts()]

    corrected = {}
    for key, hints in CORRECTED_HINTS.items():
        corrected[key] = pick_line(memory_text, hints) or memory_text

    payload = {
        "updated_artifacts": updated,
        "repair_source": "exported_from_durable_workspace_notes",
    }
    for key, text in INCORRECT_BELIEFS.items():
        payload[f"incorrect_{key}"] = text
    for key, text in corrected.items():
        payload[f"corrected_{key}"] = text

    result_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
