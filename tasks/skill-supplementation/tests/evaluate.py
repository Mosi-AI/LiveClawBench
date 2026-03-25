#!/usr/bin/env python3
"""
OpenClaw Benchmark Case 2 — Evaluation Script
================================================
Scores the model's output after two rounds of dialogue on three criteria
(30 points total):

  SKILL_REVISED     (10 pts)  The initial skill's SKILL.md was modified
                              (content differs from the original baseline).
  REVISION_CORRECT  (10 pts)  The revision mentions the Monday paper-update
                              pattern (must contain "Monday" AND at least one
                              of "paper" / "arxiv" / "weekly").
  PATTERN_DISCOVERED(10 pts)  A pattern_report.json exists somewhere in the
                              output that contains a Monday paper/arxiv/LLM
                              pattern entry.

Usage:
  # Local self-test (expects 0/30 — baseline unchanged)
  python tests/evaluate.py --baseline environment/interaction_pattern_analyzer/SKILL.md

  # Score real model output (WSL)
  python evaluate.py \
      --baseline ./interaction_pattern_analyzer/SKILL.md \
      --model-output ./model_response \
      --skills-dir ~/.openclaw/workspace/skills \
      --output-json score.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ── Scoring helpers ────────────────────────────────────────────────────

MONDAY_RE = re.compile(r"\bmonday\b", re.IGNORECASE)
PAPER_RE = re.compile(r"\b(?:paper|arxiv|weekly)\b", re.IGNORECASE)
LLM_RE = re.compile(r"\b(?:paper|arxiv|llm|large.language.model)\b", re.IGNORECASE)


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


# ── Criterion 1: SKILL_REVISED ────────────────────────────────────────

def check_skill_revised(
    baseline_hash: str,
    search_dirs: List[Path],
) -> Dict[str, Any]:
    """
    Check whether the interaction_pattern_analyzer/SKILL.md was modified.
    Searches model-output and skills directories for any SKILL.md that
    differs from the baseline hash.
    """
    candidates: List[Path] = []
    for d in search_dirs:
        candidates.extend(find_files(d, "SKILL.md"))

    # Prefer SKILL.md under interaction_pattern_analyzer/, fall back to any SKILL.md
    prioritized = sorted(
        candidates,
        key=lambda p: (0 if "interaction_pattern_analyzer" in str(p) else 1),
    )

    for cand in prioritized:
        content = read_text(cand).strip()
        if not content:
            continue
        if _sha256(content) != baseline_hash:
            return {
                "criterion": "SKILL_REVISED",
                "points": 10,
                "max_points": 10,
                "passed": True,
                "detail": str(cand),
            }

    return {
        "criterion": "SKILL_REVISED",
        "points": 0,
        "max_points": 10,
        "passed": False,
        "detail": "No revised SKILL.md found",
    }


# ── Criterion 2: REVISION_CORRECT ─────────────────────────────────────

def check_revision_correct(
    baseline_hash: str,
    search_dirs: List[Path],
) -> Dict[str, Any]:
    """
    Check that the revised SKILL.md mentions the Monday paper-update pattern.
    Requires both "Monday" AND ("paper" or "arxiv" or "weekly") to appear.
    """
    candidates: List[Path] = []
    for d in search_dirs:
        candidates.extend(find_files(d, "SKILL.md"))

    # Prefer SKILL.md under interaction_pattern_analyzer/, fall back to any SKILL.md
    prioritized = sorted(
        candidates,
        key=lambda p: (0 if "interaction_pattern_analyzer" in str(p) else 1),
    )

    for cand in prioritized:
        content = read_text(cand).strip()
        if not content or _sha256(content) == baseline_hash:
            continue
        has_monday = bool(MONDAY_RE.search(content))
        has_paper = bool(PAPER_RE.search(content))
        if has_monday and has_paper:
            return {
                "criterion": "REVISION_CORRECT",
                "points": 10,
                "max_points": 10,
                "passed": True,
                "detail": f"Found Monday + paper/arxiv/weekly in {cand}",
            }

    return {
        "criterion": "REVISION_CORRECT",
        "points": 0,
        "max_points": 10,
        "passed": False,
        "detail": "Revised SKILL.md does not mention Monday paper pattern",
    }


# ── Criterion 3: PATTERN_DISCOVERED ───────────────────────────────────

def check_pattern_discovered(
    search_dirs: List[Path],
) -> Dict[str, Any]:
    """
    Check that a pattern_report.json exists somewhere in the search dirs
    and contains a pattern entry referencing Monday + paper/arxiv/LLM.
    """
    report_files: List[Path] = []
    for d in search_dirs:
        report_files.extend(find_files(d, "pattern_report.json"))

    for rf in report_files:
        data = read_json(rf)
        if not isinstance(data, dict):
            continue
        patterns = data.get("patterns", [])
        if not isinstance(patterns, list):
            continue
        for pat in patterns:
            if not isinstance(pat, dict):
                continue
            blob = json.dumps(pat, ensure_ascii=False).lower()
            if MONDAY_RE.search(blob) and LLM_RE.search(blob):
                return {
                    "criterion": "PATTERN_DISCOVERED",
                    "points": 10,
                    "max_points": 10,
                    "passed": True,
                    "detail": f"Found Monday paper/LLM pattern in {rf}",
                }

    return {
        "criterion": "PATTERN_DISCOVERED",
        "points": 0,
        "max_points": 10,
        "passed": False,
        "detail": "No pattern_report.json with Monday paper/LLM pattern found",
    }


# ── Main ──────────────────────────────────────────────────────────────

def evaluate(
    baseline_path: Path,
    model_output_dir: Path,
    skills_dir: Path,
) -> Dict[str, Any]:
    """Run all three criteria and return a score report."""

    if not baseline_path.exists():
        print(f"ERROR: Baseline SKILL.md not found at {baseline_path}", file=sys.stderr)
        sys.exit(1)

    baseline_hash = _sha256(read_text(baseline_path).strip())

    # Directories to search for model outputs (skip non-existent)
    search_dirs = [d for d in [model_output_dir, skills_dir] if d.exists()]

    results = [
        check_skill_revised(baseline_hash, search_dirs),
        check_revision_correct(baseline_hash, search_dirs),
        check_pattern_discovered(search_dirs),
    ]

    total = sum(r["points"] for r in results)
    max_total = sum(r["max_points"] for r in results)

    return {
        "case": "sh_case2",
        "task": "SKILL_ITER",
        "total_score": total,
        "max_score": max_total,
        "criteria": results,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate OpenClaw Benchmark Case 2 — SKILL_ITER"
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
        help="Directory where the model saved its output (default: ./model_response)",
    )
    parser.add_argument(
        "--skills-dir",
        type=Path,
        default=Path("skills"),
        help="Skills directory where the model may have updated skills (default: ./skills)",
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
    )

    # Print human-readable summary
    print("=" * 60)
    print("  OpenClaw Benchmark Case 2 — Evaluation Results")
    print("=" * 60)
    for c in report["criteria"]:
        status = "PASS" if c["passed"] else "FAIL"
        print(f"  [{status}] {c['criterion']:.<30} {c['points']:>2} / {c['max_points']}")
        print(f"         {c['detail']}")
    print("-" * 60)
    print(f"  TOTAL: {report['total_score']} / {report['max_score']}")
    print("=" * 60)

    if args.output_json:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"\nScore report written to: {args.output_json}")

    sys.exit(0 if report["total_score"] == report["max_score"] else 1)


if __name__ == "__main__":
    main()
