#!/usr/bin/env python3
import json
import os
import re
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
CORPUS = ROOT / "corpus"
OUTPUT = ROOT / "output"
WORK = ROOT / "workspace"


SOURCE_ID_PATTERNS = [
    re.compile(r"^\s*source_id:\s*(\S+)\s*$", re.I),
    re.compile(r"^\s*#\s*source_id:\s*(\S+)\s*$", re.I),
    re.compile(r"^\s*<!--\s*source_id:\s*(\S+)\s*-->\s*$", re.I),
]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def discover_source_aliases() -> dict[str, str]:
    aliases: dict[str, str] = {}
    for path in sorted(CORPUS.glob("source_*")):
        text = read_text(path)
        canonical = ""
        for line in text.splitlines()[:8]:
            for pattern in SOURCE_ID_PATTERNS:
                match = pattern.match(line)
                if match:
                    canonical = match.group(1).strip()
                    break
            if canonical:
                break
        if not canonical:
            continue
        aliases[path.stem] = canonical
        aliases[path.name] = canonical
    return aliases


def canonicalize_source(source: str, aliases: dict[str, str]) -> str:
    raw = source.strip()
    if not raw:
        return raw

    candidates = [raw]
    path_like = raw.replace("\\", "/").split("/")[-1]
    if path_like != raw:
        candidates.append(path_like)
    if "." in path_like:
        candidates.append(Path(path_like).stem)

    for candidate in candidates:
        if candidate in aliases:
            return aliases[candidate]
    return raw


def normalize_sources(claim: dict, aliases: dict[str, str]) -> list[str]:
    sources = claim.get("sources")
    if isinstance(sources, str):
        sources = [sources]
    if not isinstance(sources, list):
        if isinstance(claim.get("source_ids"), list):
            sources = claim["source_ids"]
        elif isinstance(claim.get("source"), str):
            sources = [claim["source"]]
        elif isinstance(claim.get("source_id"), str):
            sources = [claim["source_id"]]
        elif isinstance(claim.get("citations"), list):
            sources = claim["citations"]
        elif isinstance(claim.get("citation"), str):
            sources = [claim["citation"]]
        else:
            sources = []

    normalized = []
    seen = set()
    for source in sources:
        if not isinstance(source, str):
            continue
        canonical = canonicalize_source(source, aliases)
        if canonical and canonical not in seen:
            normalized.append(canonical)
            seen.add(canonical)
    return normalized


def extract_claims(prov) -> tuple[dict, list] | None:
    if isinstance(prov, list):
        return {"claims": prov}, prov
    if not isinstance(prov, dict):
        return None

    claims = prov.get("claims")
    if isinstance(claims, list):
        return prov, claims

    for key in ("items", "facts", "evidence"):
        claims = prov.get(key)
        if isinstance(claims, list):
            out = dict(prov)
            out["claims"] = claims
            return out, claims
    return prov, []


def claim_text(claim: dict) -> str:
    for key in ("text", "claim", "statement", "fact"):
        value = claim.get(key)
        if isinstance(value, str):
            return value
    return ""


def normalize_provenance(aliases: dict[str, str]) -> None:
    prov_path = OUTPUT / "provenance.json"
    if not prov_path.exists():
        return

    try:
        prov = json.loads(prov_path.read_text(encoding="utf-8"))
    except Exception:
        return

    extracted = extract_claims(prov)
    if extracted is None:
        return
    prov, claims = extracted
    if not isinstance(prov, dict):
        return

    normalized_claims = []
    changed = not isinstance(prov, dict) or "claims" not in prov
    for idx, claim in enumerate(claims, start=1):
        if not isinstance(claim, dict):
            changed = True
            continue

        claim_id = claim.get("id")
        if not isinstance(claim_id, str) or not claim_id.strip():
            claim_id = f"claim_{idx}"
            changed = True

        text = claim_text(claim)
        if text != claim.get("text"):
            changed = True

        sources = normalize_sources(claim, aliases)
        if sources != claim.get("sources"):
            changed = True

        normalized_claims.append(
            {
                "id": claim_id,
                "text": text,
                "sources": sources,
            }
        )

    if changed:
        out = dict(prov)
        out["claims"] = normalized_claims
        prov_path.write_text(
            json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8"
        )


def ensure_query_log() -> None:
    notes = sorted((WORK / "memory").glob("*.md"))
    if not notes:
        return
    daily_path = notes[-1]
    log_path = OUTPUT / "browser_mock_access.jsonl"
    if not daily_path.exists() or not log_path.exists():
        return

    daily = daily_path.read_text(encoding="utf-8")
    if "query" in daily.lower():
        return

    queries = []
    seen = set()
    for line in log_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("event") != "search":
            continue
        query = str(event.get("query", "")).strip()
        if query and query not in seen:
            queries.append(query)
            seen.add(query)

    if not queries:
        return

    query_block = "\n".join(f"- Query: {query}" for query in queries)
    updated = daily.rstrip() + "\n\n## Query Log\n" + query_block + "\n"
    daily_path.write_text(updated, encoding="utf-8")


def copy_if_missing(dst: Path, src: Path) -> None:
    if dst.exists() or not src.exists():
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)


def harvest_workspace_outputs() -> None:
    workspace_output = WORK / "output"
    if workspace_output.is_dir():
        for name in (
            "result.json",
            "query_answers.json",
            "summary.md",
            "final.md",
            "answer.md",
            "provenance.json",
        ):
            copy_if_missing(OUTPUT / name, workspace_output / name)

    for name in (
        "result.json",
        "query_answers.json",
        "summary.md",
        "final.md",
        "answer.md",
        "provenance.json",
    ):
        copy_if_missing(OUTPUT / name, WORK / name)


def ensure_output_aliases() -> None:
    copy_if_missing(OUTPUT / "result.json", OUTPUT / "query_answers.json")
    copy_if_missing(OUTPUT / "query_answers.json", OUTPUT / "result.json")


def main() -> None:
    aliases = discover_source_aliases()
    harvest_workspace_outputs()
    ensure_output_aliases()
    normalize_provenance(aliases)
    ensure_query_log()


if __name__ == "__main__":
    main()
