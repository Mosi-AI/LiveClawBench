#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path.home() / ".openclaw"
OUT = ROOT / "output"
WORK = ROOT / "workspace"
KEY = Path(__file__).with_name("answer_key.json")
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

SOURCE_ID_RE = re.compile(r"source_\d+\w*", re.I)
SOURCE_ID_PATTERNS = [
    re.compile(r"^\s*source_id:\s*(\S+)\s*$", re.I),
    re.compile(r"^\s*#\s*source_id:\s*(\S+)\s*$", re.I),
    re.compile(r"^\s*<!--\s*source_id:\s*(\S+)\s*-->.*$", re.I),
]

# ---------------------------------------------------------------------------
# Key-name hints for delta category extraction
# ---------------------------------------------------------------------------

PRESERVE_HINTS = {
    "preserv",
    "kept",
    "keep",
    "unchanged",
    "still_valid",
    "retain",
    "confirmed",
    "stable",
    "correct",
    "hold",
    "solid",
}
UPDATE_HINTS = {
    "updat",
    "revis",
    "narrow",
    "chang",
    "modif",
    "refined",
    "corrected",
    "replaced",
    "replacement",
    "evolved",
    "adjusted",
}
REMOVE_HINTS = {
    "remov",
    "delet",
    "drop",
    "discard",
    "reject",
    "invalid",
    "wrong",
    "obsolete",
    "deprecated",
    "retire",
    "incorrect",
}


# ---------------------------------------------------------------------------
# JSON / text helpers
# ---------------------------------------------------------------------------


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


def normalize_source_id(value) -> str:
    s = str(value).strip().lower()
    for ext in (".md", ".html", ".txt"):
        if s.endswith(ext):
            s = s[: -len(ext)]
    return s


def discover_source_aliases() -> dict[str, str]:
    corpus = ROOT / "corpus"
    if not corpus.is_dir():
        corpus = WORK / "corpus"
    if not corpus.is_dir():
        return {}
    aliases: dict[str, str] = {}
    for path in sorted(corpus.glob("source_*")):
        text = read_text(path)
        canonical = ""
        for line in text.splitlines()[:8]:
            for pattern in SOURCE_ID_PATTERNS:
                match = pattern.match(line)
                if match:
                    canonical = match.group(1).strip().lower()
                    break
            if canonical:
                break
        stem = path.stem.lower()
        if canonical and canonical != stem:
            aliases[stem] = canonical
            aliases[canonical] = canonical
        else:
            aliases[stem] = stem
    return aliases


def canonicalize_source_id(value, aliases: dict[str, str]) -> str:
    sid = normalize_source_id(value)
    return aliases.get(sid, sid)


def normalize_source_set(values, aliases: dict[str, str] | None = None) -> set[str]:
    if not isinstance(values, list):
        return set()
    if aliases is None:
        aliases = {}
    return {
        canonicalize_source_id(item, aliases) for item in values if str(item).strip()
    }


# ---------------------------------------------------------------------------
# Flexible text extraction from arbitrary JSON structures
# ---------------------------------------------------------------------------


def _extract_text_from_value(value) -> str:
    parts: list[str] = []
    if isinstance(value, str):
        parts.append(value)
    elif isinstance(value, list):
        for item in value:
            parts.append(_extract_text_from_value(item))
    elif isinstance(value, dict):
        for v in value.values():
            parts.append(_extract_text_from_value(v))
    return " ".join(parts)


def _key_matches_hints(key: str, hints: set[str]) -> bool:
    key_lower = key.lower()
    return any(h in key_lower for h in hints)


def extract_delta_texts(result: dict) -> tuple[str, str, str]:
    """Walk result dict and extract text for preserve/update/remove categories."""
    preserve_parts: list[str] = []
    update_parts: list[str] = []
    remove_parts: list[str] = []

    def walk(obj, parent_key: str = ""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if _key_matches_hints(k, PRESERVE_HINTS):
                    preserve_parts.append(_extract_text_from_value(v))
                    if isinstance(v, (dict, list)):
                        walk(v, k)
                elif _key_matches_hints(k, UPDATE_HINTS):
                    update_parts.append(_extract_text_from_value(v))
                    if isinstance(v, (dict, list)):
                        walk(v, k)
                elif _key_matches_hints(k, REMOVE_HINTS):
                    remove_parts.append(_extract_text_from_value(v))
                    if isinstance(v, (dict, list)):
                        walk(v, k)
                else:
                    walk(v, k)
        elif isinstance(obj, list):
            for item in obj:
                walk(item, parent_key)

    walk(result)
    return (
        " ".join(preserve_parts).lower(),
        " ".join(update_parts).lower(),
        " ".join(remove_parts).lower(),
    )


def concept_in_text(text: str, keywords: list[str]) -> bool:
    return any(kw.lower() in text for kw in keywords)


# ---------------------------------------------------------------------------
# Flexible source-ID extraction
# ---------------------------------------------------------------------------


def _extract_source_ids_from_value(value) -> list[str]:
    ids: list[str] = []
    if isinstance(value, str):
        ids.extend(m.group(0).lower() for m in SOURCE_ID_RE.finditer(value))
    elif isinstance(value, list):
        for item in value:
            if isinstance(item, str):
                ids.extend(m.group(0).lower() for m in SOURCE_ID_RE.finditer(item))
            elif isinstance(item, dict):
                for k in ("source_id", "id", "source", "name", "file"):
                    v = item.get(k)
                    if isinstance(v, str):
                        ids.extend(m.group(0).lower() for m in SOURCE_ID_RE.finditer(v))
                        break
    return ids


def extract_all_source_ids(result: dict, aliases: dict[str, str]) -> set[str]:
    ids: set[str] = set()

    def walk(obj):
        if isinstance(obj, dict):
            for v in obj.values():
                for sid in _extract_source_ids_from_value(v):
                    ids.add(canonicalize_source_id(sid, aliases))
                if isinstance(v, (dict, list)):
                    walk(v)
        elif isinstance(obj, list):
            for item in obj:
                if isinstance(item, str):
                    for sid in _extract_source_ids_from_value(item):
                        ids.add(canonicalize_source_id(sid, aliases))
                elif isinstance(item, (dict, list)):
                    walk(item)

    walk(result)
    return ids


# ---------------------------------------------------------------------------
# Workspace / artifact helpers
# ---------------------------------------------------------------------------


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


def gather_durable_artifact_paths(result: dict) -> list[Path]:
    candidates: list[Path] = []
    seen: set[Path] = set()

    paths = result.get("updated_artifacts")
    if isinstance(paths, list):
        for rel in paths:
            candidate = resolve_workspace_path(rel) if isinstance(rel, str) else None
            if candidate is not None and candidate not in seen:
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

    return [c for c in candidates if is_durable_artifact(c)]


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


def load_output_texts() -> dict[str, str]:
    outputs: dict[str, str] = {}
    for name in ("final.md", "summary.md", "answer.md"):
        text = read_text(OUT / name).strip()
        if text:
            outputs[name] = text
    return outputs


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------


def structural_scores(result: dict) -> dict[str, float]:
    contract = 1.0 if result else 0.0
    modified = [
        p for p in gather_durable_artifact_paths(result) if is_modified_from_seed(p)
    ]
    workspace = 1.0 if modified else 0.0
    return {
        "result_contract_valid": contract,
        "workspace_update": workspace,
    }


def delta_scores(result: dict, key: dict) -> dict[str, float]:
    preserve_text, update_text, remove_text = extract_delta_texts(result)
    concepts = key.get("delta_concepts", {})
    expected_preserve = concepts.get("preserve", {})
    expected_update = concepts.get("update", {})
    expected_remove = concepts.get("remove", {})

    total = len(expected_preserve) + len(expected_update) + len(expected_remove)
    if total == 0:
        return {"delta_accuracy": 0.0}

    correct = 0
    for keywords in expected_preserve.values():
        if concept_in_text(preserve_text, keywords):
            correct += 1
    for keywords in expected_update.values():
        if concept_in_text(update_text, keywords):
            correct += 1
    for keywords in expected_remove.values():
        if concept_in_text(remove_text, keywords):
            correct += 1

    return {"delta_accuracy": round(correct / total, 4)}


def source_coverage_score(
    result: dict, key: dict, aliases: dict[str, str]
) -> dict[str, float]:
    actual = extract_all_source_ids(result, aliases)
    expected = normalize_source_set(key.get("evidence_source_ids"), aliases)
    if not expected:
        return {"source_coverage": 0.0}
    covered = len(actual & expected)
    return {"source_coverage": round(covered / len(expected), 4)}


def main() -> None:
    key = load_json(KEY)
    result = load_json(OUT / "result.json")
    aliases = discover_source_aliases()

    scores = structural_scores(result)
    scores.update(delta_scores(result, key))
    scores.update(source_coverage_score(result, key, aliases))

    payload = {
        "scores": scores,
        "durable_artifacts": [
            str(workspace_relpath(p)) for p in gather_durable_artifact_paths(result)
        ],
        "modified_durable_artifacts": [
            str(workspace_relpath(p))
            for p in gather_durable_artifact_paths(result)
            if is_modified_from_seed(p)
        ],
        "output_texts": sorted(load_output_texts().keys()),
    }
    (OUT / "structural_checks.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
