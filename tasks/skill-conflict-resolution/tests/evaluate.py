#!/usr/bin/env python3
"""
OpenClaw Benchmark Case 3 — Evaluation Script
================================================
Scores the model's output on its ability to:
  1. Detect conflicts between actual interaction patterns and
     misleading "Discovered Patterns" in the existing SKILL.md.
  2. Identify the real patterns from history.json.
  3. Communicate the discrepancies to the user.
  4. Correctly update the SKILL.md.

The model may produce multiple candidate skill versions, each stored
in its own subdirectory under --model-output (e.g. model_response/v1/,
model_response/attempt_2/).  The evaluator scans ALL subdirectories
recursively.  A criterion passes if ANY candidate satisfies it.

Criteria (50 points total):

  SKILL_UPDATED        (10 pts)  SKILL.md content differs from baseline.
  CONFLICT_IDENTIFIED  (10 pts)  Model conversation / report flags that existing
                                 "Discovered Patterns" are wrong or conflict
                                 with the actual history data.
  WEDNESDAY_PATTERN    (10 pts)  Updated SKILL.md or pattern_report.json mentions
                                 a Wednesday code-review pattern.
  FRIDAY_PATTERN       (10 pts)  Updated SKILL.md or pattern_report.json mentions
                                 a Friday weekly-digest / summary pattern.
  MISLEADING_CORRECTED (10 pts)  Updated SKILL.md no longer contains the false
                                 "Monday Morning Paper Reading" pattern as a
                                 confirmed/active pattern.

Usage:
  # Local self-test (expects 0/50 — baseline unchanged)
  python tests/evaluate.py --baseline environment/interaction_pattern_analyzer/SKILL.md

  # Score real model output (possibly with multiple subdirectories)
  python evaluate.py \\
      --baseline ./interaction_pattern_analyzer/SKILL.md \\
      --model-output ./model_response \\
      --skills-dir ~/.openclaw/workspace/skills \\
      --conversation-log ./conversation.jsonl \\
      --output-json score.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ── Regex patterns ────────────────────────────────────────────────────

# Real patterns that should be discovered
WEDNESDAY_RE = re.compile(r"\bwednesday\b", re.IGNORECASE)
CODE_REVIEW_RE = re.compile(
    r"\b(?:code[\s_-]?review|PR[\s_-]?review|pull[\s_-]?request[\s_-]?review|review[\s_-]?PR|review[\s_-]?code|代码[\s_-]?审查|代码[\s_-]?review)\b",
    re.IGNORECASE,
)

FRIDAY_RE = re.compile(r"\bfriday\b", re.IGNORECASE)
DIGEST_RE = re.compile(
    r"\b(?:digest|weekly[\s_-]?report|weekly[\s_-]?summary|周报|工作[\s_-]?总结|工作[\s_-]?摘要|progress[\s_-]?summary|weekly[\s_-]?digest)\b",
    re.IGNORECASE,
)

# Misleading pattern that should be removed/corrected
MONDAY_PAPER_RE = re.compile(
    r"\bmonday\b.*?\b(?:paper|arxiv)\b|\b(?:paper|arxiv)\b.*?\bmonday\b",
    re.IGNORECASE | re.DOTALL,
)

# Conflict detection keywords in conversation
CONFLICT_KEYWORDS_RE = re.compile(
    r"\b(?:conflict|mismatch|incorrect|inaccurate|outdated|wrong|"
    r"contradict|discrepan|inconsisten|not[\s_]match|does[\s_]not[\s_]align|"
    r"误导|不一致|不准确|错误|过时|冲突|矛盾)\b",
    re.IGNORECASE,
)

# Pattern used to decide whether a SKILL.md probably belongs to the
# interaction_pattern_analyzer (vs. some unrelated skill that happens
# to live in skills_dir).
_IPA_PATH_RE = re.compile(r"interaction.pattern.analy[sz]er", re.IGNORECASE)


# ── Helpers ───────────────────────────────────────────────────────────


def find_files(root: Path, name: str) -> List[Path]:
    """Recursively find all files matching *name* under *root*."""
    if not root.exists():
        return []
    return list(root.rglob(name))


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except Exception:
        return ""


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _collect_skill_texts(
    baseline_hash: str,
    model_output_dirs: List[Path],
    skills_dirs: List[Path],
) -> List[Tuple[str, Path]]:
    """Return (text, path) of every revised SKILL.md found.

    For *model_output_dirs* every SKILL.md is accepted (the model may
    store its output in arbitrarily-named subdirectories).

    For *skills_dirs* only files whose path contains
    "interaction_pattern_analyzer" are considered so we don't
    accidentally pick up unrelated skills.
    """
    seen_hashes: set[str] = set()
    results: List[Tuple[str, Path]] = []

    # --- model output: accept any SKILL.md ---
    for d in model_output_dirs:
        for cand in find_files(d, "SKILL.md"):
            content = read_text(cand).strip()
            if not content:
                continue
            h = _sha256(content)
            if h == baseline_hash or h in seen_hashes:
                continue
            seen_hashes.add(h)
            results.append((content, cand))

    # --- skills workspace: only interaction_pattern_analyzer ---
    for d in skills_dirs:
        for cand in find_files(d, "SKILL.md"):
            if not _IPA_PATH_RE.search(str(cand)):
                continue
            content = read_text(cand).strip()
            if not content:
                continue
            h = _sha256(content)
            if h == baseline_hash or h in seen_hashes:
                continue
            seen_hashes.add(h)
            results.append((content, cand))

    return results


def _collect_pattern_reports(
    model_output_dirs: List[Path],
    skills_dirs: List[Path],
) -> List[Tuple[dict, Path]]:
    """Return (data, path) of every pattern_report.json found."""
    results: List[Tuple[dict, Path]] = []
    all_dirs = model_output_dirs + skills_dirs
    seen: set[str] = set()
    for d in all_dirs:
        for rf in find_files(d, "pattern_report.json"):
            rp = str(rf)
            if rp in seen:
                continue
            seen.add(rp)
            data = read_json(rf)
            if isinstance(data, dict):
                results.append((data, rf))
    return results


def _load_conversation(conversation_log: Optional[Path]) -> str:
    """Load all conversation text from a JSONL log or plain text file."""
    if conversation_log is None or not conversation_log.exists():
        return ""
    text = read_text(conversation_log)
    # Try JSONL: each line is a JSON object with "content" or "text" field
    lines = text.strip().splitlines()
    parts: List[str] = []
    for line in lines:
        try:
            obj = json.loads(line)
            for key in ("content", "text", "message", "response"):
                if key in obj and isinstance(obj[key], str):
                    parts.append(obj[key])
        except (json.JSONDecodeError, TypeError):
            parts.append(line)
    return "\n".join(parts)


# ── Criterion 1: SKILL_UPDATED ────────────────────────────────────────


def check_skill_updated(
    baseline_hash: str,
    model_output_dirs: List[Path],
    skills_dirs: List[Path],
) -> Dict[str, Any]:
    """Check whether at least one SKILL.md was modified."""
    texts = _collect_skill_texts(baseline_hash, model_output_dirs, skills_dirs)
    if texts:
        locations = [str(p) for _, p in texts]
        return {
            "criterion": "SKILL_UPDATED",
            "points": 10,
            "max_points": 10,
            "passed": True,
            "detail": f"Found {len(texts)} revised SKILL.md file(s): {locations}",
        }
    return {
        "criterion": "SKILL_UPDATED",
        "points": 0,
        "max_points": 10,
        "passed": False,
        "detail": "No revised SKILL.md found in any model output subdirectory",
    }


# ── Criterion 2: CONFLICT_IDENTIFIED ─────────────────────────────────


def check_conflict_identified(
    baseline_hash: str,
    model_output_dirs: List[Path],
    skills_dirs: List[Path],
    conversation_text: str,
) -> Dict[str, Any]:
    """
    Check that the model explicitly identified conflicts between the
    existing SKILL.md patterns and the actual history data.
    Searches conversation log, pattern reports, and revised SKILL.md.
    """
    # Check conversation for conflict-related keywords
    if CONFLICT_KEYWORDS_RE.search(conversation_text):
        return {
            "criterion": "CONFLICT_IDENTIFIED",
            "points": 10,
            "max_points": 10,
            "passed": True,
            "detail": "Conflict/mismatch language found in conversation",
        }

    # Check pattern reports for conflict mentions
    for data, rf in _collect_pattern_reports(model_output_dirs, skills_dirs):
        blob = json.dumps(data, ensure_ascii=False).lower()
        if CONFLICT_KEYWORDS_RE.search(blob):
            return {
                "criterion": "CONFLICT_IDENTIFIED",
                "points": 10,
                "max_points": 10,
                "passed": True,
                "detail": f"Conflict/mismatch found in {rf}",
            }

    # Check revised SKILL.md for notes about conflicts
    for content, path in _collect_skill_texts(
        baseline_hash, model_output_dirs, skills_dirs
    ):
        if CONFLICT_KEYWORDS_RE.search(content):
            return {
                "criterion": "CONFLICT_IDENTIFIED",
                "points": 10,
                "max_points": 10,
                "passed": True,
                "detail": f"Conflict/mismatch noted in {path}",
            }

    return {
        "criterion": "CONFLICT_IDENTIFIED",
        "points": 0,
        "max_points": 10,
        "passed": False,
        "detail": "No conflict identification found in conversation or any output",
    }


# ── Criterion 3: WEDNESDAY_PATTERN ───────────────────────────────────


def check_wednesday_pattern(
    baseline_hash: str,
    model_output_dirs: List[Path],
    skills_dirs: List[Path],
) -> Dict[str, Any]:
    """
    Check that the model discovered the Wednesday code-review pattern
    in either any updated SKILL.md or any pattern_report.json.
    Requires both 'Wednesday' AND a code-review keyword.
    """
    # Check revised SKILL.md files
    for content, path in _collect_skill_texts(
        baseline_hash, model_output_dirs, skills_dirs
    ):
        if WEDNESDAY_RE.search(content) and CODE_REVIEW_RE.search(content):
            return {
                "criterion": "WEDNESDAY_PATTERN",
                "points": 10,
                "max_points": 10,
                "passed": True,
                "detail": f"Wednesday + code review found in {path}",
            }

    # Check pattern reports
    for data, rf in _collect_pattern_reports(model_output_dirs, skills_dirs):
        patterns = data.get("patterns", [])
        if not isinstance(patterns, list):
            continue
        for pat in patterns:
            if not isinstance(pat, dict):
                continue
            blob = json.dumps(pat, ensure_ascii=False)
            if WEDNESDAY_RE.search(blob) and CODE_REVIEW_RE.search(blob):
                return {
                    "criterion": "WEDNESDAY_PATTERN",
                    "points": 10,
                    "max_points": 10,
                    "passed": True,
                    "detail": f"Wednesday + code review found in {rf}",
                }

    return {
        "criterion": "WEDNESDAY_PATTERN",
        "points": 0,
        "max_points": 10,
        "passed": False,
        "detail": "Wednesday code-review pattern not found in any output",
    }


# ── Criterion 4: FRIDAY_PATTERN ──────────────────────────────────────


def check_friday_pattern(
    baseline_hash: str,
    model_output_dirs: List[Path],
    skills_dirs: List[Path],
) -> Dict[str, Any]:
    """
    Check that the model discovered the Friday weekly-digest pattern
    in either any updated SKILL.md or any pattern_report.json.
    Requires both 'Friday' AND a digest/summary keyword.
    """
    # Check revised SKILL.md files
    for content, path in _collect_skill_texts(
        baseline_hash, model_output_dirs, skills_dirs
    ):
        if FRIDAY_RE.search(content) and DIGEST_RE.search(content):
            return {
                "criterion": "FRIDAY_PATTERN",
                "points": 10,
                "max_points": 10,
                "passed": True,
                "detail": f"Friday + weekly digest found in {path}",
            }

    # Check pattern reports
    for data, rf in _collect_pattern_reports(model_output_dirs, skills_dirs):
        patterns = data.get("patterns", [])
        if not isinstance(patterns, list):
            continue
        for pat in patterns:
            if not isinstance(pat, dict):
                continue
            blob = json.dumps(pat, ensure_ascii=False)
            if FRIDAY_RE.search(blob) and DIGEST_RE.search(blob):
                return {
                    "criterion": "FRIDAY_PATTERN",
                    "points": 10,
                    "max_points": 10,
                    "passed": True,
                    "detail": f"Friday + weekly digest found in {rf}",
                }

    return {
        "criterion": "FRIDAY_PATTERN",
        "points": 0,
        "max_points": 10,
        "passed": False,
        "detail": "Friday weekly-digest pattern not found in any output",
    }


# ── Criterion 5: MISLEADING_CORRECTED ────────────────────────────────

_CORRECTED_RE = re.compile(
    r"(?:removed|incorrect|inaccurate|outdated|deprecated|"
    r"not[\s_]?found|no[\s_]?evidence|corrected|replaced|"
    r"删除|已移除|不准确|已修正).*?"
    r"\b(?:monday|paper|arxiv)\b|"
    r"\b(?:monday|paper|arxiv)\b.*?"
    r"(?:removed|incorrect|inaccurate|outdated|deprecated|"
    r"not[\s_]?found|no[\s_]?evidence|corrected|replaced|"
    r"删除|已移除|不准确|已修正)",
    re.IGNORECASE | re.DOTALL,
)


def check_misleading_corrected(
    baseline_hash: str,
    model_output_dirs: List[Path],
    skills_dirs: List[Path],
) -> Dict[str, Any]:
    """
    Check that at least one revised SKILL.md no longer presents the
    false 'Monday Morning Paper Reading' as a confirmed/active pattern.

    Passes if ANY candidate satisfies one of:
      - Does not contain the Monday+paper pattern at all, OR
      - Contains it but explicitly marks it as removed/incorrect.
    """
    revised = _collect_skill_texts(baseline_hash, model_output_dirs, skills_dirs)
    if not revised:
        return {
            "criterion": "MISLEADING_CORRECTED",
            "points": 0,
            "max_points": 10,
            "passed": False,
            "detail": "No revised SKILL.md to check",
        }

    for content, path in revised:
        has_monday_paper = bool(MONDAY_PAPER_RE.search(content))
        if not has_monday_paper:
            return {
                "criterion": "MISLEADING_CORRECTED",
                "points": 10,
                "max_points": 10,
                "passed": True,
                "detail": f"Monday paper pattern removed from {path}",
            }
        if _CORRECTED_RE.search(content):
            return {
                "criterion": "MISLEADING_CORRECTED",
                "points": 10,
                "max_points": 10,
                "passed": True,
                "detail": f"Monday paper pattern explicitly marked as incorrect in {path}",
            }

    return {
        "criterion": "MISLEADING_CORRECTED",
        "points": 0,
        "max_points": 10,
        "passed": False,
        "detail": "Misleading Monday paper pattern still present as active in all revised SKILL.md files",
    }


# ── Main ──────────────────────────────────────────────────────────────


def evaluate(
    baseline_path: Path,
    model_output_dir: Path,
    skills_dir: Path,
    conversation_log: Optional[Path] = None,
) -> Dict[str, Any]:
    """Run all five criteria and return a score report.

    *model_output_dir* is scanned recursively — the model may have saved
    multiple candidate versions in separate subdirectories.
    """

    if not baseline_path.exists():
        print(
            f"ERROR: Baseline SKILL.md not found at {baseline_path}",
            file=sys.stderr,
        )
        sys.exit(1)

    baseline_hash = _sha256(read_text(baseline_path).strip())

    # model_output_dir itself is the root; rglob handles subdirectories.
    model_output_dirs = [model_output_dir] if model_output_dir.exists() else []
    skills_dirs = [skills_dir] if skills_dir.exists() else []

    # Log discovered subdirectories for transparency
    if model_output_dirs:
        subdirs = sorted(
            {p.parent for p in model_output_dir.rglob("SKILL.md")}
            | {p.parent for p in model_output_dir.rglob("pattern_report.json")}
        )
        if subdirs:
            print(
                f"  Discovered {len(subdirs)} output location(s) under {model_output_dir}:"
            )
            for sd in subdirs:
                print(f"    - {sd}")
            print()

    conversation_text = _load_conversation(conversation_log)

    results = [
        check_skill_updated(baseline_hash, model_output_dirs, skills_dirs),
        check_conflict_identified(
            baseline_hash, model_output_dirs, skills_dirs, conversation_text
        ),
        check_wednesday_pattern(baseline_hash, model_output_dirs, skills_dirs),
        check_friday_pattern(baseline_hash, model_output_dirs, skills_dirs),
        check_misleading_corrected(baseline_hash, model_output_dirs, skills_dirs),
    ]

    total = sum(r["points"] for r in results)
    max_total = sum(r["max_points"] for r in results)

    return {
        "case": "sh_case3",
        "task": "SKILL_CONFLICT_DETECTION",
        "total_score": total,
        "max_score": max_total,
        "criteria": results,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate OpenClaw Benchmark Case 3 — Skill Conflict Detection & Upgrade"
    )
    parser.add_argument(
        "--baseline",
        type=Path,
        required=True,
        help="Path to the original (unmodified) interaction_pattern_analyzer/SKILL.md",
    )
    parser.add_argument(
        "--model-output",
        type=Path,
        default=Path("model_response"),
        help="Root directory where the model saved output (scanned recursively, "
        "including all subdirectories like v1/, attempt_2/, etc.)",
    )
    parser.add_argument(
        "--skills-dir",
        type=Path,
        default=Path("skills"),
        help="Skills workspace directory (default: ./skills)",
    )
    parser.add_argument(
        "--conversation-log",
        type=Path,
        default=None,
        help="Path to conversation log (JSONL or plain text) for checking conflict communication",
    )
    parser.add_argument(
        "--output-json",
        type=Path,
        default=None,
        help="Write JSON score report to this file",
    )
    args = parser.parse_args()

    report = evaluate(
        baseline_path=args.baseline.resolve(),
        model_output_dir=args.model_output.resolve(),
        skills_dir=args.skills_dir.resolve(),
        conversation_log=(
            args.conversation_log.resolve() if args.conversation_log else None
        ),
    )

    # Print human-readable summary
    print("=" * 64)
    print("  OpenClaw Benchmark Case 3 — Evaluation Results")
    print("  (Skill Conflict Detection & Upgrade)")
    print("=" * 64)
    for c in report["criteria"]:
        status = "PASS" if c["passed"] else "FAIL"
        print(
            f"  [{status}] {c['criterion']:.<35} {c['points']:>2} / {c['max_points']}"
        )
        print(f"         {c['detail']}")
    print("-" * 64)
    print(f"  TOTAL: {report['total_score']} / {report['max_score']}")
    print("=" * 64)

    if args.output_json:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"\nScore report written to: {args.output_json}")

    sys.exit(0 if report["total_score"] == report["max_score"] else 1)


if __name__ == "__main__":
    main()
