"""
Evaluation script for sh_case4: Skill Deduplication & Consolidation.

Scores a model's skill consolidation effort against the ground truth overlap map
and reference pipeline. Max score: 100 points.

The model is expected to restructure the *sales-data-pipeline* skill directory
from 14 fragmented sub-modules into a smaller set of consolidated sub-skills,
each with its own SKILL.md.

Usage:
    python tests/evaluate.py --base-dir . --model-output <path_to_skill_dir>
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Ground truth data
# ---------------------------------------------------------------------------

ORIGINAL_SKILLS = [
    "csv_data_loader",
    "excel_data_reader",
    "data_ingestion_service",
    "null_value_processor",
    "data_deduplicator",
    "data_cleaning_toolkit",
    "schema_validator",
    "business_rule_checker",
    "numeric_normalizer",
    "feature_calculator",
    "data_aggregator",
    "summary_report_generator",
    "csv_export_writer",
    "multi_format_exporter",
]

# Functional capabilities that must be preserved (keywords to search for in SKILL.md)
REQUIRED_CAPABILITIES = {
    "ingestion": {
        "csv_loading": ["csv", "comma-separated", "delimiter"],
        "excel_loading": ["excel", "xlsx", "xls", "workbook"],
        "json_loading": ["json"],
        "encoding_detection": ["encoding", "chardet", "utf"],
        "date_parsing": ["date", "datetime", "parse"],
    },
    "cleaning": {
        "null_handling": ["null", "missing", "nan", "empty", "imput"],
        "deduplication": ["duplicate", "dedup"],
        "type_coercion": ["type", "coerci", "convert", "cast"],
        "whitespace_trimming": ["whitespace", "strip", "trim"],
        "outlier_detection": ["outlier", "zscore", "iqr", "standard deviation"],
    },
    "validation": {
        "schema_check": ["schema", "column", "required", "type check"],
        "business_rules": ["rule", "positive", "range", "constraint"],
        "referential_integrity": ["reference", "lookup", "catalog", "foreign"],
    },
    "transformation": {
        "normalization": ["normali", "scal", "min-max", "z-score"],
        "revenue_calculation": ["revenue", "quantity", "price", "multiply"],
        "margin_calculation": ["margin", "cost", "profit"],
        "time_features": ["year", "month", "weekday", "week_number"],
        "moving_average": ["moving average", "rolling", "window"],
    },
    "aggregation_reporting": {
        "group_by": ["group", "aggregat", "sum", "mean", "count"],
        "pivot_table": ["pivot", "cross-tab", "matrix"],
        "kpi_report": ["kpi", "summary", "total revenue", "top product"],
        "time_trends": ["daily", "weekly", "monthly", "trend"],
    },
    "export": {
        "csv_export": ["csv", "export", "write", "delimiter"],
        "json_export": ["json"],
        "multi_format": ["parquet", "excel", "multiple format"],
    },
}

# Known overlap pairs (for checking if model identifies them)
OVERLAP_PAIRS = [
    ("csv_data_loader", "data_ingestion_service", "subset"),
    ("excel_data_reader", "data_ingestion_service", "subset"),
    ("null_value_processor", "data_cleaning_toolkit", "subset"),
    ("data_deduplicator", "data_cleaning_toolkit", "subset"),
    ("schema_validator", "business_rule_checker", "overlap"),
    ("numeric_normalizer", "feature_calculator", "overlap"),
    ("data_aggregator", "summary_report_generator", "overlap"),
    ("csv_export_writer", "multi_format_exporter", "subset"),
]


# ---------------------------------------------------------------------------
# Scoring helpers
# ---------------------------------------------------------------------------


def read_skill_md(skill_dir: Path) -> str:
    """Read SKILL.md from a skill directory."""
    md_path = skill_dir / "SKILL.md"
    if md_path.exists():
        return md_path.read_text(encoding="utf-8").lower()
    return ""


def find_consolidated_skills(output_dir: Path) -> list:
    """Find all consolidated sub-skill directories inside the model output.

    The model output is the sales-data-pipeline skill directory.
    We look for sub-directories that contain a SKILL.md file and are NOT
    one of the original 14 fragmented skills (unless the model kept them).

    We also consider the top-level SKILL.md as part of the consolidated
    content when checking capability coverage, but for counting purposes
    we only count sub-directories with their own SKILL.md.
    """
    if not output_dir.exists():
        return []

    found = []
    for item in output_dir.iterdir():
        if item.is_dir() and (item / "SKILL.md").exists():
            found.append(item)

    # If no sub-dirs have SKILL.md but the top-level does, treat it as
    # a single consolidated skill (the model merged everything into one).
    if not found and (output_dir / "SKILL.md").exists():
        found.append(output_dir)

    return found


def get_all_skill_content(output_dir: Path, consolidated_skills: list) -> str:
    """Aggregate all SKILL.md content for capability checking.

    Includes both the top-level SKILL.md and all sub-skill SKILL.md files.
    """
    all_content = ""
    top_md = output_dir / "SKILL.md"
    if top_md.exists():
        all_content += top_md.read_text(encoding="utf-8").lower() + "\n"
    for skill_dir in consolidated_skills:
        if skill_dir != output_dir:
            all_content += read_skill_md(skill_dir) + "\n"
    return all_content


def check_redundancy_identified(conversation_log: str) -> tuple:
    """Check if model identified redundancy pairs."""
    score = 0
    identified = []

    for s1, s2, rel_type in OVERLAP_PAIRS:
        s1_clean = s1.replace("_", "[_ -]?")
        s2_clean = s2.replace("_", "[_ -]?")

        found = False
        for match in re.finditer(s1_clean, conversation_log, re.IGNORECASE):
            start = max(0, match.start() - 200)
            end = min(len(conversation_log), match.end() + 500)
            window = conversation_log[start:end]
            if re.search(s2_clean, window, re.IGNORECASE):
                found = True
                break

        if found:
            identified.append(f"{s1} <-> {s2}")

    ratio = len(identified) / len(OVERLAP_PAIRS)
    if ratio >= 0.625:
        score = 15
    elif ratio >= 0.375:
        score = 10
    elif ratio >= 0.25:
        score = 5

    return score, {
        "identified_pairs": identified,
        "total_pairs": len(OVERLAP_PAIRS),
        "ratio": round(ratio, 2),
    }


def check_coverage_preserved(output_dir: Path, consolidated_skills: list) -> tuple:
    """Check all functional capabilities are preserved."""
    all_content = get_all_skill_content(output_dir, consolidated_skills)

    found_capabilities = {}
    missing_capabilities = {}

    for stage, caps in REQUIRED_CAPABILITIES.items():
        found_capabilities[stage] = {}
        missing_capabilities[stage] = []
        for cap_name, keywords in caps.items():
            cap_found = any(kw in all_content for kw in keywords)
            found_capabilities[stage][cap_name] = cap_found
            if not cap_found:
                missing_capabilities[stage].append(cap_name)

    total_caps = sum(len(caps) for caps in REQUIRED_CAPABILITIES.values())
    found_count = sum(
        sum(1 for v in caps.values() if v) for caps in found_capabilities.values()
    )

    ratio = found_count / total_caps
    if ratio >= 0.9:
        score = 20
    elif ratio >= 0.75:
        score = 15
    elif ratio >= 0.6:
        score = 10
    elif ratio >= 0.4:
        score = 5
    else:
        score = 0

    return score, {
        "total_capabilities": total_caps,
        "found": found_count,
        "ratio": round(ratio, 2),
        "missing": {k: v for k, v in missing_capabilities.items() if v},
    }


def check_skill_count_reduced(consolidated_skills: list) -> tuple:
    """Check skill count is reduced to 6 or fewer (from 14)."""
    count = len(consolidated_skills)

    if count <= 6:
        score = 15
    elif count <= 8:
        score = 10
    elif count <= 10:
        score = 5
    else:
        score = 0

    return score, {
        "original_count": 14,
        "consolidated_count": count,
        "reduction_ratio": round(1 - count / 14, 2),
    }


def check_overlap_eliminated(consolidated_skills: list) -> tuple:
    """Check no two consolidated skills have >30% keyword overlap."""
    skill_keywords = {}
    for skill_dir in consolidated_skills:
        content = read_skill_md(skill_dir)
        words = set(re.findall(r"\b[a-z]{4,}\b", content))
        skill_keywords[skill_dir.name] = words

    overlapping_pairs = []
    names = list(skill_keywords.keys())

    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = skill_keywords[names[i]], skill_keywords[names[j]]
            if not a or not b:
                continue
            intersection = len(a & b)
            union = len(a | b)
            jaccard = intersection / union if union > 0 else 0
            if jaccard > 0.30:
                overlapping_pairs.append(
                    {
                        "pair": [names[i], names[j]],
                        "jaccard_similarity": round(jaccard, 3),
                    }
                )

    if not overlapping_pairs:
        score = 15
    elif len(overlapping_pairs) <= 1:
        score = 10
    elif len(overlapping_pairs) <= 3:
        score = 5
    else:
        score = 0

    return score, {
        "overlapping_pairs": overlapping_pairs,
        "total_pairs_checked": len(names) * (len(names) - 1) // 2,
    }


def check_pipeline_coherent(consolidated_skills: list) -> tuple:
    """Check skills form a logical pipeline sequence."""
    stage_keywords = {
        "ingestion": ["ingest", "load", "read", "import", "parse"],
        "cleaning": ["clean", "null", "missing", "dedup", "duplicate", "coerci"],
        "validation": ["valid", "schema", "rule", "check", "constrain"],
        "transformation": ["transform", "feature", "calculat", "normaliz", "deriv"],
        "aggregation_reporting": ["aggregat", "group", "summary", "report", "kpi"],
        "export": ["export", "write", "output", "format", "csv.*write"],
    }

    covered_stages = set()
    skill_stage_map = {}

    for skill_dir in consolidated_skills:
        content = read_skill_md(skill_dir)
        best_stage = None
        best_score = 0
        for stage, keywords in stage_keywords.items():
            hits = sum(1 for kw in keywords if re.search(kw, content, re.IGNORECASE))
            if hits > best_score:
                best_score = hits
                best_stage = stage
        if best_stage:
            covered_stages.add(best_stage)
            skill_stage_map[skill_dir.name] = best_stage

    coverage = len(covered_stages) / len(stage_keywords)

    if coverage >= 0.83:
        score = 15
    elif coverage >= 0.67:
        score = 10
    elif coverage >= 0.5:
        score = 5
    else:
        score = 0

    return score, {
        "stages_covered": sorted(covered_stages),
        "stages_missing": sorted(set(stage_keywords.keys()) - covered_stages),
        "skill_stage_map": skill_stage_map,
        "coverage": round(coverage, 2),
    }


def check_skill_quality(consolidated_skills: list) -> tuple:
    """Check SKILL.md quality -- structure and content."""
    quality_checks = {
        "has_frontmatter": r"^---\n.*?---",
        "has_description": r"description:",
        "has_inputs": r"## input|## parameter|## argument|\binput\b.*:`",
        "has_outputs": r"## output|\boutput\b.*:",
        "has_implementation": r"## implementation|command:|python3",
        "has_summary": r"## .*summary|## skill summary|## overview",
    }

    skill_scores = {}
    total = 0

    for skill_dir in consolidated_skills:
        content = read_skill_md(skill_dir)
        raw_content = ""
        md_path = skill_dir / "SKILL.md"
        if md_path.exists():
            raw_content = md_path.read_text(encoding="utf-8")
        checks_passed = 0
        for check_name, pattern in quality_checks.items():
            target = raw_content if check_name == "has_frontmatter" else content
            if re.search(pattern, target, re.IGNORECASE | re.DOTALL):
                checks_passed += 1
        skill_scores[skill_dir.name] = checks_passed / len(quality_checks)
        total += skill_scores[skill_dir.name]

    avg_quality = total / len(consolidated_skills) if consolidated_skills else 0

    if avg_quality >= 0.8:
        score = 10
    elif avg_quality >= 0.6:
        score = 7
    elif avg_quality >= 0.4:
        score = 4
    else:
        score = 0

    return score, {
        "per_skill_quality": {k: round(v, 2) for k, v in skill_scores.items()},
        "average_quality": round(avg_quality, 2),
    }


def check_consolidation_rationale(conversation_log: str) -> tuple:
    """Check if model provides clear rationale for merge decisions."""
    rationale_indicators = [
        r"merg(e|ed|ing)",
        r"consolidat(e|ed|ing)",
        r"combin(e|ed|ing)",
        r"redundan(t|cy)",
        r"overlap(s|ping)?",
        r"subset",
        r"superset",
        r"duplicat(e|ed|ion)",
        r"eliminat(e|ed|ing)",
    ]

    found_indicators = []
    for pattern in rationale_indicators:
        if re.search(pattern, conversation_log, re.IGNORECASE):
            found_indicators.append(pattern)

    ratio = len(found_indicators) / len(rationale_indicators)

    if ratio >= 0.6:
        score = 10
    elif ratio >= 0.4:
        score = 7
    elif ratio >= 0.2:
        score = 4
    else:
        score = 0

    return score, {
        "rationale_indicators_found": len(found_indicators),
        "total_indicators": len(rationale_indicators),
        "ratio": round(ratio, 2),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def evaluate(base_dir: str, model_output: str, conversation_log: str = "") -> dict:
    """Run full evaluation and return results."""
    output = Path(model_output)
    consolidated = find_consolidated_skills(output)

    results = {
        "skill_name": "sales-data-pipeline",
        "max_score": 100,
        "total_score": 0,
        "criteria": {},
    }

    # 1. Redundancy identified (15 pts)
    if conversation_log:
        s, d = check_redundancy_identified(conversation_log)
    else:
        s, d = 0, {"note": "No conversation log provided; skipping"}
    results["criteria"]["REDUNDANCY_IDENTIFIED"] = {"score": s, "max": 15, "details": d}
    results["total_score"] += s

    # 2. Coverage preserved (20 pts)
    s, d = check_coverage_preserved(output, consolidated)
    results["criteria"]["COVERAGE_PRESERVED"] = {"score": s, "max": 20, "details": d}
    results["total_score"] += s

    # 3. Skill count reduced (15 pts)
    s, d = check_skill_count_reduced(consolidated)
    results["criteria"]["SKILL_COUNT_REDUCED"] = {"score": s, "max": 15, "details": d}
    results["total_score"] += s

    # 4. Overlap eliminated (15 pts)
    s, d = check_overlap_eliminated(consolidated)
    results["criteria"]["OVERLAP_ELIMINATED"] = {"score": s, "max": 15, "details": d}
    results["total_score"] += s

    # 5. Pipeline coherent (15 pts)
    s, d = check_pipeline_coherent(consolidated)
    results["criteria"]["PIPELINE_COHERENT"] = {"score": s, "max": 15, "details": d}
    results["total_score"] += s

    # 6. Skill quality (10 pts)
    s, d = check_skill_quality(consolidated)
    results["criteria"]["SKILL_QUALITY"] = {"score": s, "max": 10, "details": d}
    results["total_score"] += s

    # 7. Consolidation rationale (10 pts)
    if conversation_log:
        s, d = check_consolidation_rationale(conversation_log)
    else:
        s, d = 0, {"note": "No conversation log provided; skipping"}
    results["criteria"]["CONSOLIDATION_RATIONALE"] = {
        "score": s,
        "max": 10,
        "details": d,
    }
    results["total_score"] += s

    return results


def main():
    parser = argparse.ArgumentParser(description="Evaluate skill consolidation")
    parser.add_argument("--base-dir", required=True, help="Base directory of the case")
    parser.add_argument(
        "--model-output",
        required=True,
        help="Path to the skill directory (e.g. environment/skills/sales-data-pipeline)",
    )
    parser.add_argument(
        "--conversation-log", default="", help="Path to conversation log file"
    )
    parser.add_argument("--output-json", default="", help="Write results to JSON file")
    args = parser.parse_args()

    conv_log = ""
    if args.conversation_log and os.path.exists(args.conversation_log):
        with open(args.conversation_log, "r", encoding="utf-8") as f:
            conv_log = f.read()

    results = evaluate(args.base_dir, args.model_output, conv_log)

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
