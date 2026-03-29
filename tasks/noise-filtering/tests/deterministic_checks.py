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
    re.compile(r"^\s*<!--\s*source_id:\s*(\S+)\s*-->\s*$", re.I),
]

RELIABLE_KEY_HINTS = {
    "reliable",
    "trusted",
    "signal",
    "keep",
    "credible",
    "good",
    "accurate",
}
REJECTED_KEY_HINTS = {
    "rejected",
    "misleading",
    "noisy",
    "noise",
    "unreliable",
    "hype",
    "bad",
    "reject",
    "discard",
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


def normalize_source_id(value) -> str:
    s = str(value).strip().lower()
    for ext in (".md", ".html", ".txt"):
        if s.endswith(ext):
            s = s[: -len(ext)]
    return s


def discover_source_aliases() -> dict[str, str]:
    """Build alias map: filename_stem -> canonical_source_id from corpus headers."""
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


def _extract_source_ids_from_value(value) -> list[str]:
    ids = []
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


def _key_matches_hints(key: str, hints: set[str]) -> bool:
    key_lower = key.lower()
    return any(h in key_lower for h in hints)


def extract_source_partition(
    result: dict, aliases: dict[str, str]
) -> tuple[set[str], set[str]]:
    reliable: set[str] = set()
    rejected: set[str] = set()

    def walk(obj, parent_key: str = ""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if _key_matches_hints(k, RELIABLE_KEY_HINTS):
                    for sid in _extract_source_ids_from_value(v):
                        reliable.add(canonicalize_source_id(sid, aliases))
                    if isinstance(v, (dict, list)):
                        walk(v, k)
                elif _key_matches_hints(k, REJECTED_KEY_HINTS):
                    for sid in _extract_source_ids_from_value(v):
                        rejected.add(canonicalize_source_id(sid, aliases))
                    if isinstance(v, (dict, list)):
                        walk(v, k)
                else:
                    walk(v, k)
        elif isinstance(obj, list):
            for item in obj:
                walk(item, parent_key)

    walk(result)

    if not reliable:
        for k in (
            "reliable_source_ids",
            "reliable_sources",
            "trusted_sources",
            "signal_sources",
        ):
            v = result.get(k)
            if isinstance(v, list):
                reliable = normalize_source_set(v, aliases)
                break
    if not rejected:
        for k in (
            "rejected_source_ids",
            "rejected_sources",
            "misleading_sources",
            "noise_sources",
            "noisy_sources",
        ):
            v = result.get(k)
            if isinstance(v, list):
                rejected = normalize_source_set(v, aliases)
                break

    return reliable, rejected


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


def load_output_texts() -> dict[str, str]:
    outputs = {}
    for name in ("final.md", "summary.md", "answer.md"):
        text = read_text(OUT / name).strip()
        if text:
            outputs[name] = text
    return outputs


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


def source_scores(result: dict, key: dict, aliases: dict[str, str]) -> dict[str, float]:
    actual_reliable, actual_rejected = extract_source_partition(result, aliases)
    expected_reliable = normalize_source_set(key.get("reliable_source_ids"), aliases)
    expected_rejected = normalize_source_set(key.get("rejected_source_ids"), aliases)

    all_expected = expected_reliable | expected_rejected
    if not all_expected:
        return {"source_partition_accuracy": 0.0}

    correct = 0
    for sid in all_expected:
        if (
            sid in expected_reliable
            and sid in actual_reliable
            and sid not in actual_rejected
        ):
            correct += 1
        elif (
            sid in expected_rejected
            and sid in actual_rejected
            and sid not in actual_reliable
        ):
            correct += 1

    spurious = (actual_reliable | actual_rejected) - all_expected
    penalty = len(spurious)

    source_partition_accuracy = round(
        max(0.0, correct - penalty) / len(all_expected), 4
    )

    return {
        "source_partition_accuracy": source_partition_accuracy,
    }


def main() -> None:
    key = load_json(KEY)
    result = load_json(OUT / "result.json")
    aliases = discover_source_aliases()
    scores = structural_scores(result)
    scores.update(source_scores(result, key, aliases))
    payload = {
        "scores": scores,
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
