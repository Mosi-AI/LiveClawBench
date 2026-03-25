"""
Evaluation script for sh_case5: Skill Hierarchy Change Propagation.

Scores a model's ability to propagate bottom-level skill changes upward through
a 3-level nested skill hierarchy. Max score: 100 points.

After applying patches to 3 bottom-level skills (csv-parser, column-calculator,
stats-aggregator), the model must update the 3 mid-level SKILL.md files and
the 1 top-level SKILL.md to reflect the changes.

Usage:
    python tests/evaluate.py --model-output <path_to_skill_dir>
"""

import argparse
import json
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Which files we check (mid-level + top-level only; bottom-level is patched)
# ---------------------------------------------------------------------------

UPPER_LEVEL_FILES = {
    "top": "SKILL.md",
    "data-loader": "data-loader/SKILL.md",
    "data-transformer": "data-transformer/SKILL.md",
    "report-renderer": "report-renderer/SKILL.md",
}


def read_upper_content(output_dir: Path) -> dict:
    """Read all upper-level SKILL.md files."""
    content = {}
    for key, rel_path in UPPER_LEVEL_FILES.items():
        fpath = output_dir / rel_path
        if fpath.exists():
            content[key] = fpath.read_text(encoding="utf-8")
        else:
            content[key] = ""
    return content


def lower(text: str) -> str:
    return text.lower()


# ---------------------------------------------------------------------------
# Criterion 1: PARAM_PROPAGATED (20 pts)
# New params from bottom skills appear in mid and top levels.
# ---------------------------------------------------------------------------

PARAM_CHECKS = [
    # (param_keyword, must_appear_in_files, source_description)
    ("quote-char", ["data-loader", "top"], "csv-parser → data-loader, top"),
    ("comment-prefix", ["data-loader", "top"], "csv-parser → data-loader, top"),
    (
        "rank-method",
        ["data-transformer", "top"],
        "column-calculator → data-transformer, top",
    ),
    (
        "percentiles",
        ["report-renderer", "top"],
        "stats-aggregator → report-renderer, top",
    ),
]


def check_param_propagated(content: dict) -> tuple:
    """Check new parameters are propagated to upper levels."""
    total = 0
    found = 0
    details = []

    for param, targets, desc in PARAM_CHECKS:
        for target in targets:
            total += 1
            text = lower(content.get(target, ""))
            if param.lower() in text:
                found += 1
                details.append(f"OK: '{param}' found in {target}")
            else:
                details.append(f"MISS: '{param}' not found in {target}")

    ratio = found / total if total > 0 else 0
    if ratio >= 0.875:
        score = 20
    elif ratio >= 0.625:
        score = 14
    elif ratio >= 0.375:
        score = 8
    elif ratio > 0:
        score = 4
    else:
        score = 0

    return score, {
        "found": found,
        "total": total,
        "ratio": round(ratio, 2),
        "details": details,
    }


# ---------------------------------------------------------------------------
# Criterion 2: STALE_REMOVED (15 pts)
# Old/incorrect descriptions are corrected.
# ---------------------------------------------------------------------------

STALE_CHECKS = [
    # (stale_pattern, file_key, description)
    # data-loader still says "comma and tab" only
    (
        r"supports?\s+(only\s+)?comma\s+(and|&)\s+tab",
        "data-loader",
        "data-loader still says 'comma and tab' only",
    ),
    # data-loader says other delimiters not supported
    (
        r"other\s+delimiters\s+are\s+not\s+(currently\s+)?supported",
        "data-loader",
        "data-loader still says other delimiters not supported",
    ),
    # data-transformer still lists 'ratio' as available
    (
        r"\bratio\b.*\bcol_a\s*/\s*col_b\b",
        "data-transformer",
        "data-transformer still shows ratio formula",
    ),
    # top-level still has '--calc ratio' in examples
    (r"--calc\s+ratio", "top", "top-level example still uses '--calc ratio'"),
    # top-level delimiter description only mentions comma and tab
    (
        r"supports?\s+comma\s+\(`,`\)\s+and\s+tab",
        "top",
        "top-level still says 'comma and tab' for delimiter",
    ),
    # report-renderer says "six metrics are the complete set"
    (
        r"six\s+metrics\s+are\s+the\s+complete\s+set",
        "report-renderer",
        "report-renderer still says 'six metrics are the complete set'",
    ),
]


def check_stale_removed(content: dict) -> tuple:
    """Check stale descriptions have been corrected."""
    total = len(STALE_CHECKS)
    fixed = 0
    details = []

    for pattern, file_key, desc in STALE_CHECKS:
        text = content.get(file_key, "")
        if not re.search(pattern, text, re.IGNORECASE):
            fixed += 1
            details.append(f"FIXED: {desc}")
        else:
            details.append(f"STALE: {desc}")

    ratio = fixed / total if total > 0 else 0
    if ratio >= 0.83:
        score = 15
    elif ratio >= 0.67:
        score = 10
    elif ratio >= 0.5:
        score = 7
    elif ratio > 0:
        score = 3
    else:
        score = 0

    return score, {
        "fixed": fixed,
        "total": total,
        "ratio": round(ratio, 2),
        "details": details,
    }


# ---------------------------------------------------------------------------
# Criterion 3: NEW_CAPABILITY_DOC (20 pts)
# New capabilities documented in upper levels.
# ---------------------------------------------------------------------------

CAPABILITY_CHECKS = [
    # (keyword, must_appear_in_files, description)
    # csv-parser: pipe and semicolon delimiters
    ("pipe", ["data-loader"], "pipe delimiter in data-loader"),
    ("|", ["data-loader", "top"], "pipe char in data-loader/top"),
    (";", ["data-loader", "top"], "semicolon char in data-loader/top"),
    # column-calculator: new calc types
    (
        "percentage",
        ["data-transformer", "top"],
        "percentage calc in data-transformer/top",
    ),
    (
        "cumulative_sum",
        ["data-transformer", "top"],
        "cumulative_sum calc in data-transformer/top",
    ),
    ("rank", ["data-transformer", "top"], "rank calc in data-transformer/top"),
    # stats-aggregator: new metrics
    (
        "percentile",
        ["report-renderer", "top"],
        "percentile metric in report-renderer/top",
    ),
    ("mode", ["report-renderer", "top"], "mode metric in report-renderer/top"),
]


def check_new_capability_doc(content: dict) -> tuple:
    """Check new capabilities are documented in upper levels."""
    total = 0
    found = 0
    details = []

    for keyword, targets, desc in CAPABILITY_CHECKS:
        for target in targets:
            total += 1
            text = lower(content.get(target, ""))
            if keyword.lower() in text:
                found += 1
                details.append(f"OK: '{keyword}' in {target}")
            else:
                details.append(f"MISS: '{keyword}' not in {target}")

    ratio = found / total if total > 0 else 0
    if ratio >= 0.85:
        score = 20
    elif ratio >= 0.65:
        score = 14
    elif ratio >= 0.45:
        score = 8
    elif ratio > 0:
        score = 4
    else:
        score = 0

    return score, {
        "found": found,
        "total": total,
        "ratio": round(ratio, 2),
        "details": details,
    }


# ---------------------------------------------------------------------------
# Criterion 4: OUTPUT_SCHEMA_UPDATED (15 pts)
# Stats report metadata and new metrics in output descriptions.
# ---------------------------------------------------------------------------

SCHEMA_CHECKS = [
    # (keyword, file_keys, description)
    ("metadata", ["report-renderer", "top"], "metadata field in report-renderer/top"),
    ("timestamp", ["report-renderer", "top"], "timestamp in report-renderer/top"),
    ("total_rows", ["report-renderer"], "total_rows in report-renderer"),
    ("group_count", ["report-renderer"], "group_count in report-renderer"),
    ("metrics_computed", ["report-renderer"], "metrics_computed in report-renderer"),
    ("percentile_25", ["report-renderer"], "percentile_25 example in report-renderer"),
    ("percentile_75", ["report-renderer"], "percentile_75 example in report-renderer"),
]


def check_output_schema_updated(content: dict) -> tuple:
    """Check output schema descriptions are updated."""
    total = 0
    found = 0
    details = []

    for keyword, targets, desc in SCHEMA_CHECKS:
        for target in targets:
            total += 1
            text = lower(content.get(target, ""))
            if keyword.lower() in text:
                found += 1
                details.append(f"OK: '{keyword}' in {target}")
            else:
                details.append(f"MISS: '{keyword}' not in {target}")

    ratio = found / total if total > 0 else 0
    if ratio >= 0.78:
        score = 15
    elif ratio >= 0.56:
        score = 10
    elif ratio >= 0.33:
        score = 5
    elif ratio > 0:
        score = 2
    else:
        score = 0

    return score, {
        "found": found,
        "total": total,
        "ratio": round(ratio, 2),
        "details": details,
    }


# ---------------------------------------------------------------------------
# Criterion 5: VERSION_BUMPED (10 pts)
# Mid-level and top-level version numbers have changed from 1.0.0.
# ---------------------------------------------------------------------------


def check_version_bumped(content: dict) -> tuple:
    """Check that version numbers have been updated."""
    bumped = []
    unbumped = []

    for key in ["top", "data-loader", "data-transformer", "report-renderer"]:
        text = content.get(key, "")
        match = re.search(r"version:\s*(\S+)", text)
        if match:
            ver = match.group(1)
            if ver != "1.0.0":
                bumped.append(f"{key}: {ver}")
            else:
                unbumped.append(f"{key}: still 1.0.0")
        else:
            unbumped.append(f"{key}: no version found")

    ratio = len(bumped) / 4
    if ratio >= 0.75:
        score = 10
    elif ratio >= 0.5:
        score = 7
    elif ratio >= 0.25:
        score = 4
    else:
        score = 0

    return score, {"bumped": bumped, "unbumped": unbumped, "ratio": round(ratio, 2)}


# ---------------------------------------------------------------------------
# Criterion 6: CODE_EXAMPLE_FIXED (10 pts)
# Top-level code examples no longer use deprecated features.
# ---------------------------------------------------------------------------


def check_code_example_fixed(content: dict) -> tuple:
    """Check that code examples in top-level are updated."""
    top = content.get("top", "")
    checks = {
        "no_ratio_in_example": not bool(re.search(r"--calc\s+ratio", top)),
        "has_new_calc_example": bool(
            re.search(r"--calc\s+(percentage|cumulative_sum|rank)", top)
        ),
        "delimiter_example_updated": bool(re.search(r'-d\s+"?\|"?', top))
        or bool(re.search(r'-d\s+"\|"', top))
        or bool(re.search(r"-d\s+'?\|'?", top)),
        "has_percentiles_example": bool(re.search(r"--percentiles", top)),
        "has_comment_prefix_example": bool(
            re.search(r"--comment-prefix", top, re.IGNORECASE)
        ),
    }

    passed = sum(1 for v in checks.values() if v)
    total = len(checks)
    ratio = passed / total

    if ratio >= 0.8:
        score = 10
    elif ratio >= 0.6:
        score = 7
    elif ratio >= 0.4:
        score = 4
    elif ratio > 0:
        score = 2
    else:
        score = 0

    return score, {
        "checks": {k: "PASS" if v else "FAIL" for k, v in checks.items()},
        "passed": passed,
        "total": total,
        "ratio": round(ratio, 2),
    }


# ---------------------------------------------------------------------------
# Criterion 7: CROSS_CUTTING (10 pts)
# Awareness that stats-aggregator output changes affect format-writer/report-renderer.
# ---------------------------------------------------------------------------


def check_cross_cutting(content: dict) -> tuple:
    """Check cross-module awareness."""
    checks = {}

    # report-renderer mentions metadata in schema description
    rr = lower(content.get("report-renderer", ""))
    checks["rr_mentions_metadata_in_schema"] = "metadata" in rr

    # format-writer awareness: report-renderer or top mentions that format-writer
    # handles the metadata section
    checks["rr_format_writer_handles_metadata"] = "metadata" in rr and (
        "format" in rr or "writer" in rr
    )

    # top-level output schema includes metadata
    top = lower(content.get("top", ""))
    checks["top_output_has_metadata"] = "metadata" in top and "stats_report" in top

    # data-transformer acknowledges ratio removal
    dt = lower(content.get("data-transformer", ""))
    checks["dt_ratio_removal_noted"] = (
        "removed" in dt or "deprecated" in dt or "no longer" in dt
    ) and "ratio" in dt

    passed = sum(1 for v in checks.values() if v)
    total = len(checks)
    ratio = passed / total

    if ratio >= 0.75:
        score = 10
    elif ratio >= 0.5:
        score = 7
    elif ratio >= 0.25:
        score = 4
    else:
        score = 0

    return score, {
        "checks": {k: "PASS" if v else "FAIL" for k, v in checks.items()},
        "passed": passed,
        "total": total,
        "ratio": round(ratio, 2),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def evaluate(model_output: str) -> dict:
    """Run full evaluation."""
    output = Path(model_output)
    content = read_upper_content(output)

    results = {
        "skill_name": "report-generator-pipeline",
        "max_score": 100,
        "total_score": 0,
        "criteria": {},
    }

    criteria_funcs = [
        ("PARAM_PROPAGATED", 20, check_param_propagated),
        ("STALE_REMOVED", 15, check_stale_removed),
        ("NEW_CAPABILITY_DOC", 20, check_new_capability_doc),
        ("OUTPUT_SCHEMA_UPDATED", 15, check_output_schema_updated),
        ("VERSION_BUMPED", 10, check_version_bumped),
        ("CODE_EXAMPLE_FIXED", 10, check_code_example_fixed),
        ("CROSS_CUTTING", 10, check_cross_cutting),
    ]

    for crit_id, max_pts, func in criteria_funcs:
        score, details = func(content)
        results["criteria"][crit_id] = {
            "score": score,
            "max": max_pts,
            "details": details,
        }
        results["total_score"] += score

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate skill hierarchy change propagation"
    )
    parser.add_argument(
        "--model-output",
        required=True,
        help="Path to report-generator-pipeline skill directory",
    )
    parser.add_argument("--output-json", default="", help="Write results to JSON file")
    args = parser.parse_args()

    results = evaluate(args.model_output)

    print(json.dumps(results, indent=2, ensure_ascii=False))

    if args.output_json:
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\nResults written to {args.output_json}")

    print(f"\n{'=' * 50}")
    print(f"TOTAL SCORE: {results['total_score']} / {results['max_score']}")
    print(f"{'=' * 50}")

    return 0 if results["total_score"] > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
