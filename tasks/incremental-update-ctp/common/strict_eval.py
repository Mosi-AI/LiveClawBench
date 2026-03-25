import json
import re
from pathlib import Path

IGNORED_WORKSPACE_ROOT_FILES = {
    "AGENTS.md",
    "BOOTSTRAP.md",
    "HEARTBEAT.md",
    "IDENTITY.md",
    "MEMORY.md",
    "SOUL.md",
    "TOOLS.md",
    "USER.md",
}


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def read_first_existing(paths) -> str:
    for path in paths:
        if path.exists():
            return read_text(path)
    return ""


def read_final_text(output_dir: Path) -> str:
    return read_first_existing(
        [
            output_dir / "summary.md",
            output_dir / "final.md",
            output_dir / "answer.md",
        ]
    )


def normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[`*_#>\-]", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def contains_all_headers(text: str, headers):
    return all(h in text for h in headers)


def any_pattern(text: str, patterns):
    for p in patterns:
        if re.search(p, text, flags=re.I | re.S):
            return True
    return False


def all_keywords_present(text: str, keywords):
    low = normalize(text)
    return all(k.lower() in low for k in keywords)


def count_keyword_hits(text: str, claims):
    low = normalize(text)
    hits = 0
    for claim in claims:
        if isinstance(claim, dict):
            groups = claim.get("match_any", [])
            if groups and any(all(k.lower() in low for k in grp) for grp in groups):
                hits += 1
        else:
            prefix = normalize(str(claim))[:24]
            if prefix and prefix in low:
                hits += 1
    return hits


def load_provenance(path: Path):
    raw = read_text(path)
    if not raw:
        return None, ["missing provenance.json"]
    try:
        prov = json.loads(raw)
    except Exception as e:
        return None, [f"invalid provenance json: {e}"]
    errors = []
    if not isinstance(prov, dict):
        return None, ["provenance root must be object"]
    claims = prov.get("claims")
    if not isinstance(claims, list):
        errors.append("claims must be list")
        claims = []
    seen_ids = set()
    texts = []
    for idx, c in enumerate(claims):
        if not isinstance(c, dict):
            errors.append(f"claim[{idx}] must be object")
            continue
        cid = c.get("id")
        txt = c.get("text")
        srcs = c.get("sources")
        if not isinstance(cid, str) or not cid.strip():
            errors.append(f"claim[{idx}] missing id")
        elif cid in seen_ids:
            errors.append(f"duplicate claim id: {cid}")
        else:
            seen_ids.add(cid)
        if not isinstance(txt, str) or len(normalize(txt)) < 18:
            errors.append(f"claim[{idx}] text too short")
        else:
            texts.append(normalize(txt))
        if (
            not isinstance(srcs, list)
            or not srcs
            or not all(isinstance(s, str) and s for s in srcs)
        ):
            errors.append(f"claim[{idx}] invalid sources")
    # near duplicate text penalty signal
    dup_count = 0
    for i in range(len(texts)):
        for j in range(i + 1, len(texts)):
            a = set(texts[i].split())
            b = set(texts[j].split())
            if a and b:
                jacc = len(a & b) / len(a | b)
                if jacc > 0.82:
                    dup_count += 1
    return prov, errors + ([f"{dup_count} near-duplicate claims"] if dup_count else [])


def load_optional_provenance(path: Path):
    prov, errors = load_provenance(path)
    if prov is None:
        return {"claims": []}, []
    return prov, errors


def workspace_root_notes(workspace_dir: Path):
    return sorted(
        path
        for path in workspace_dir.glob("*.md")
        if path.name not in IGNORED_WORKSPACE_ROOT_FILES and path.is_file()
    )


def resolve_latest_note(workspace_dir: Path):
    note_dirs = [
        workspace_dir / "memory",
        workspace_dir / "state",
        workspace_dir / "notes",
    ]
    notes = []
    for note_dir in note_dirs:
        if note_dir.is_dir():
            notes.extend(sorted(note_dir.rglob("*.md")))
    notes.extend(workspace_root_notes(workspace_dir))
    return notes[-1] if notes else None


def read_durable_state(workspace_dir: Path) -> str:
    parts = []
    for root_file in (workspace_dir / "MEMORY.md",):
        if root_file.exists():
            parts.append(read_text(root_file))
    for path in workspace_root_notes(workspace_dir):
        parts.append(read_text(path))
    for state_dir in (
        workspace_dir / "state",
        workspace_dir / "memory",
        workspace_dir / "notes",
    ):
        if not state_dir.is_dir():
            continue
        for path in sorted(state_dir.rglob("*.md")):
            parts.append(read_text(path))
    return "\n".join(part for part in parts if part)


def provenance_stats(prov, allowed_sources=None, required_sources=None, min_claims=0):
    claims = prov.get("claims", []) if isinstance(prov, dict) else []
    used = set()
    for c in claims:
        if isinstance(c, dict):
            for s in c.get("sources", []):
                if isinstance(s, str):
                    used.add(s)
    stats = {
        "claim_count_ok": 1.0 if len(claims) >= min_claims else 0.0,
        "used_sources": sorted(used),
        "invalid_sources": [],
    }
    if allowed_sources is not None:
        stats["invalid_sources"] = sorted(
            s for s in used if s not in set(allowed_sources)
        )
    if required_sources:
        req = set(required_sources)
        stats["source_coverage"] = round(len(req & used) / len(req), 4)
    else:
        stats["source_coverage"] = 1.0
    return stats


def source_role_patterns(source_id: str):
    low = str(source_id).lower()
    groups = []
    mapping = [
        ("paper", [r"\bpaper\b", r"\bformal\b"]),
        ("video", [r"\bvideo\b", r"\btalk\b", r"\btranscript\b"]),
        ("transcript", [r"\bvideo\b", r"\btalk\b", r"\btranscript\b"]),
        ("article", [r"\barticle\b", r"\bpublic\b", r"\bblog\b"]),
        ("memo", [r"\bmemo\b", r"\binternal\b"]),
        ("review", [r"\breview\b", r"\bthread\b"]),
        ("note", [r"\bnote\b", r"\bnotes\b"]),
        ("baseline", [r"\bbaseline\b", r"\boriginal\b", r"\bearlier\b"]),
        ("addendum", [r"\baddendum\b", r"\bupdate\b", r"\bfollow[- ]up\b"]),
        ("browser", [r"\bbrowser\b", r"\bportal\b"]),
    ]
    for token, patterns in mapping:
        if token in low:
            groups.extend(patterns)
    return groups


def infer_source_coverage(text: str, required_sources) -> float:
    req = list(required_sources or [])
    if not req:
        return 1.0
    hits = 0
    for source_id in req:
        patterns = source_role_patterns(source_id)
        if patterns and any_pattern(text, patterns):
            hits += 1
    return round(hits / len(req), 4)


def weighted_sum(score, rubric):
    return round(sum(score.get(k, 0.0) * w for k, w in rubric.items()), 4)
