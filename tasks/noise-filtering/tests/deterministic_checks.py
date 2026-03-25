#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path.home() / ".openclaw"
OUT = ROOT / "output"
WORK = ROOT / "workspace"
CORPUS = ROOT / "corpus"
KEY = Path(__file__).with_name("answer_key.json")
LOCAL_SEED_WORK = Path(__file__).resolve().parents[1] / "environment" / "workspace_seed"

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


def load_json(path: Path):
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def normalize(value) -> str:
    return str(value).strip().lower()


def resolve_workspace_path(rel_path: str) -> Path | None:
    if not isinstance(rel_path, str) or not rel_path.strip():
        return None
    candidate = (WORK / rel_path).resolve()
    try:
        candidate.relative_to(WORK.resolve())
    except ValueError:
        return None
    return candidate


def is_durable_artifact(path: Path) -> bool:
    if not path.is_file() or path.suffix != ".md" or path.stat().st_size <= 0:
        return False
    try:
        rel = path.resolve().relative_to(WORK.resolve())
    except ValueError:
        return False
    if rel.parts and rel.parts[0] in {"corpus", "output"}:
        return False
    if path.parent == WORK and path.name in SYSTEM_ROOT_FILES:
        return False
    return True


def workspace_relpath(path: Path) -> Path:
    return path.resolve().relative_to(WORK.resolve())


def listed_artifact_paths(result: dict) -> list[Path]:
    paths = result.get("updated_artifacts")
    if not isinstance(paths, list):
        return []
    resolved = []
    for rel in paths:
        candidate = resolve_workspace_path(rel)
        if candidate is not None:
            resolved.append(candidate)
    return resolved


def gather_durable_artifact_paths(result: dict) -> list[Path]:
    candidates: list[Path] = []
    seen: set[Path] = set()

    for candidate in listed_artifact_paths(result):
        if candidate not in seen:
            candidates.append(candidate)
            seen.add(candidate)

    for candidate in WORK.glob("*.md"):
        if candidate not in seen:
            candidates.append(candidate)
            seen.add(candidate)

    for subdir in ("memory", "state", "notes"):
        root = WORK / subdir
        if not root.is_dir():
            continue
        for candidate in sorted(root.glob("*.md")):
            if candidate not in seen:
                candidates.append(candidate)
                seen.add(candidate)

    return [candidate for candidate in candidates if is_durable_artifact(candidate)]


def seed_workspace_root() -> Path | None:
    for candidate in (Path("/task/workspace"), LOCAL_SEED_WORK):
        if candidate.is_dir():
            return candidate
    return None


def is_modified_from_seed(path: Path) -> bool:
    if not is_durable_artifact(path):
        return False
    seed_root = seed_workspace_root()
    if seed_root is None:
        return True
    rel = workspace_relpath(path)
    seed_path = seed_root / rel
    if not seed_path.exists():
        return True
    return read_text(path) != read_text(seed_path)


def load_corpus_docs() -> list[dict]:
    docs = []
    for path in sorted(CORPUS.glob("source_*")):
        docs.append(
            {
                "path": str(path.relative_to(ROOT)),
                "content": read_text(path),
            }
        )
    return docs


def load_output_texts() -> dict[str, str]:
    outputs = {}
    for name in ("final.md", "summary.md", "answer.md"):
        text = read_text(OUT / name).strip()
        if text:
            outputs[name] = text
    return outputs


def structural_scores(result: dict, key: dict) -> dict[str, float]:
    task_ok = normalize(result.get("task_id")) == normalize(key.get("task_id"))
    topic_ok = normalize(result.get("topic_id")) == normalize(key.get("topic_id"))

    if task_ok and topic_ok:
        contract = 1.0
    elif result:
        contract = 0.5
    else:
        contract = 0.0

    listed_valid = [
        path for path in listed_artifact_paths(result) if is_modified_from_seed(path)
    ]
    modified_durable_paths = [
        path
        for path in gather_durable_artifact_paths(result)
        if is_modified_from_seed(path)
    ]
    if listed_valid:
        workspace = 1.0
    elif modified_durable_paths:
        workspace = 0.5
    else:
        workspace = 0.0

    return {
        "result_contract_valid": contract,
        "workspace_update": workspace,
    }


def main() -> None:
    key = load_json(KEY)
    result = load_json(OUT / "result.json")
    payload = {
        "scores": structural_scores(result, key),
        "durable_artifacts": [
            str(workspace_relpath(path))
            for path in gather_durable_artifact_paths(result)
        ],
        "modified_durable_artifacts": [
            str(workspace_relpath(path))
            for path in gather_durable_artifact_paths(result)
            if is_modified_from_seed(path)
        ],
        "output_texts": sorted(load_output_texts().keys()),
    }
    (OUT / "structural_checks.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
