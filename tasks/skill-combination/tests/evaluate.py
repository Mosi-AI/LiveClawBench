#!/usr/bin/env python3
"""
Evaluation script for sh_skill_combination:
Cross-Skill Composition Recognition & Composite Skill Construction.

Scores a model's ability to recognise that two existing skills (log-parser and
csv-stats-reporter) can be composed into a pipeline, and to proactively build
a composite higher-order skill — while ignoring a distractor skill
(text-sentiment-scorer).

Max score: 100 points across 6 criteria.

Usage:
    python tests/evaluate.py --model-output <path> [--dialogue <path>] [--output-json <path>]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ============================================================================
# Criterion 1: COMPOSITE_SKILL_CREATED (20 pts)
# A new SKILL.md exists that describes a composite/pipeline skill.
# ============================================================================

def check_composite_skill_created(model_dir: Path) -> Tuple[int, Dict[str, Any]]:
    """Check that a new SKILL.md was created for the composite skill."""
    skill_files = list(model_dir.rglob("SKILL.md"))
    details: Dict[str, Any] = {"skill_files_found": [str(f) for f in skill_files]}

    if not skill_files:
        return 0, {**details, "reason": "No SKILL.md found in model_response/"}

    # Read the first SKILL.md found
    skill_content = skill_files[0].read_text(encoding="utf-8")
    details["skill_path"] = str(skill_files[0])
    details["content_length"] = len(skill_content)

    # Must have YAML frontmatter with name and description
    has_frontmatter = bool(re.search(r'^---\s*\n.*?name:\s*\S+.*?\n.*?---', skill_content, re.DOTALL))
    has_description = bool(re.search(r'description:\s*.+', skill_content))

    # Must mention pipeline/composite/combined concept
    pipeline_keywords = r'pipelin|combin|composit|chain|orchestrat|two.step|multi.step|workflow'
    has_pipeline_concept = bool(re.search(pipeline_keywords, skill_content, re.IGNORECASE))

    # Must have some substance (> 200 chars)
    has_substance = len(skill_content) > 200

    checks = {
        "has_frontmatter": has_frontmatter,
        "has_description": has_description,
        "has_pipeline_concept": has_pipeline_concept,
        "has_substance": has_substance,
    }
    details["checks"] = {k: "PASS" if v else "FAIL" for k, v in checks.items()}

    passed = sum(1 for v in checks.values() if v)
    if passed == 4:
        score = 20
    elif passed >= 3:
        score = 15
    elif passed >= 2:
        score = 10
    elif passed >= 1:
        score = 5
    else:
        score = 0

    return score, details


# ============================================================================
# Criterion 2: CORRECT_SKILLS_SELECTED (15 pts)
# References log-parser AND csv-stats-reporter but NOT text-sentiment-scorer.
# ============================================================================

def check_correct_skills_selected(model_dir: Path) -> Tuple[int, Dict[str, Any]]:
    """Check that the composite skill references the right sub-skills."""
    # Gather all text content from model_response
    all_text = ""
    for f in model_dir.rglob("*"):
        if f.is_file() and f.suffix in (".md", ".py", ".sh", ".txt", ".toml", ".yaml", ".yml", ".json"):
            try:
                all_text += f.read_text(encoding="utf-8") + "\n"
            except (UnicodeDecodeError, OSError):
                pass

    if not all_text:
        return 0, {"reason": "No readable files found in model_response/"}

    text_lower = all_text.lower()

    # Check references
    refs_log_parser = bool(re.search(r'log[-_]?parser', text_lower))
    refs_stats_reporter = bool(re.search(r'(csv[-_]?)?stats[-_]?reporter', text_lower))
    refs_sentiment = bool(re.search(r'sentiment[-_]?scorer', text_lower))

    # Also check for importing/calling the actual scripts
    calls_log_parser = bool(re.search(r'log_parser\.py|log-parser/', text_lower))
    calls_stats_reporter = bool(re.search(r'stats_reporter\.py|csv-stats-reporter/', text_lower))

    checks = {
        "references_log_parser": refs_log_parser,
        "references_stats_reporter": refs_stats_reporter,
        "does_NOT_reference_sentiment": not refs_sentiment,
        "calls_log_parser_script": calls_log_parser,
        "calls_stats_reporter_script": calls_stats_reporter,
    }

    details = {k: "PASS" if v else "FAIL" for k, v in checks.items()}

    # Core requirement: must reference both correct skills
    if not (refs_log_parser and refs_stats_reporter):
        return 0, {"checks": details, "reason": "Missing reference to one or both required skills"}

    # Penalty for including the distractor
    if refs_sentiment:
        # References sentiment scorer — partial credit only
        score = 5
        details["penalty"] = "Included distractor skill (text-sentiment-scorer)"
    else:
        # Correct: both required, no distractor
        passed = sum(1 for v in checks.values() if v)
        if passed == 5:
            score = 15
        elif passed >= 4:
            score = 12
        else:
            score = 8

    return score, {"checks": details}


# ============================================================================
# Criterion 3: PIPELINE_IMPLEMENTATION (20 pts)
# A working implementation script that chains log-parser → csv-stats-reporter.
# ============================================================================

def check_pipeline_implementation(model_dir: Path) -> Tuple[int, Dict[str, Any]]:
    """Check that a pipeline implementation script exists and is reasonable."""
    # Look for Python scripts
    py_files = list(model_dir.rglob("*.py"))
    sh_files = list(model_dir.rglob("*.sh"))
    impl_files = py_files + sh_files

    details: Dict[str, Any] = {"implementation_files": [str(f) for f in impl_files]}

    if not impl_files:
        return 0, {**details, "reason": "No implementation script found"}

    # Read the main implementation (prefer .py)
    impl_file = py_files[0] if py_files else sh_files[0]
    impl_content = impl_file.read_text(encoding="utf-8")
    details["impl_path"] = str(impl_file)
    details["impl_length"] = len(impl_content)
    impl_lower = impl_content.lower()

    checks = {}

    # 1. Must invoke or import log-parser functionality
    checks["invokes_log_parser"] = bool(
        re.search(r'log_parser|log-parser|log.parser', impl_lower)
        or re.search(r'subprocess.*log', impl_lower)
        or re.search(r'import.*log_parser', impl_lower)
        # Also accept if it reimplements the core logic (jsonl → csv)
        or (re.search(r'json\.loads', impl_lower) and re.search(r'csv', impl_lower))
    )

    # 2. Must invoke or import stats-reporter functionality
    checks["invokes_stats_reporter"] = bool(
        re.search(r'stats_reporter|stats-reporter|stats.reporter', impl_lower)
        or re.search(r'subprocess.*stats', impl_lower)
        or re.search(r'import.*stats_reporter', impl_lower)
        # Also accept reimplementation (csv → stats computation)
        or (re.search(r'mean|median|percentile', impl_lower) and re.search(r'csv', impl_lower))
    )

    # 3. Must have a sequential flow (step 1 output → step 2 input)
    checks["has_sequential_flow"] = bool(
        # Explicit temp file or piping
        re.search(r'temp|tmp|intermediate|step.?1.*step.?2|output.*input', impl_lower)
        # Or subprocess chaining
        or re.search(r'subprocess\.run.*subprocess\.run', impl_content, re.DOTALL)
        # Or function call chaining
        or re.search(r'(filtered|parsed|csv).*=.*\n.*stat', impl_content, re.DOTALL)
        # Or variable passing between stages
        or re.search(r'stage|phase|pipeline|chain', impl_lower)
    )

    # 4. Has entry point (main, argparse, or if __name__)
    checks["has_entry_point"] = bool(
        re.search(r'if\s+__name__\s*==', impl_content)
        or re.search(r'argparse', impl_lower)
        or re.search(r'def\s+main', impl_lower)
        or re.search(r'#!/', impl_content)
    )

    # 5. Non-trivial implementation (> 30 lines)
    line_count = len([l for l in impl_content.splitlines() if l.strip()])
    checks["non_trivial"] = line_count >= 20

    details["checks"] = {k: "PASS" if v else "FAIL" for k, v in checks.items()}
    details["line_count"] = line_count

    passed = sum(1 for v in checks.values() if v)
    if passed == 5:
        score = 20
    elif passed >= 4:
        score = 16
    elif passed >= 3:
        score = 12
    elif passed >= 2:
        score = 8
    elif passed >= 1:
        score = 4
    else:
        score = 0

    return score, details


# ============================================================================
# Criterion 4: UNIFIED_INTERFACE (15 pts)
# The composite skill exposes a unified CLI with parameters from both sub-skills.
# ============================================================================

def check_unified_interface(model_dir: Path) -> Tuple[int, Dict[str, Any]]:
    """Check that the composite skill has a unified interface."""
    # Read all content from SKILL.md files
    skill_files = list(model_dir.rglob("SKILL.md"))
    if not skill_files:
        return 0, {"reason": "No SKILL.md found"}

    skill_content = skill_files[0].read_text(encoding="utf-8")
    skill_lower = skill_content.lower()

    # Also check implementation files for argparse definitions
    impl_text = ""
    for f in model_dir.rglob("*.py"):
        try:
            impl_text += f.read_text(encoding="utf-8") + "\n"
        except (UnicodeDecodeError, OSError):
            pass
    impl_lower = impl_text.lower()
    combined = skill_lower + "\n" + impl_lower

    checks = {}

    # Parameters from log-parser that should appear in composite
    checks["has_input_param"] = bool(re.search(r'-i\b|--input|input.*jsonl|log.*file', combined))
    checks["has_output_param"] = bool(re.search(r'-o\b|--output|output.*json|report.*file', combined))
    checks["has_time_range"] = bool(re.search(r'--start|--end|time.?range|start.?time|end.?time', combined))
    checks["has_severity_filter"] = bool(re.search(r'--levels?|severity|error.*warn|log.?level', combined))

    # Parameters from csv-stats-reporter
    checks["has_columns_or_metrics"] = bool(re.search(r'--columns?|--metrics?|response.?time|numeric', combined))
    checks["has_group_by"] = bool(re.search(r'--group|group.?by|service', combined))

    details = {k: "PASS" if v else "FAIL" for k, v in checks.items()}

    passed = sum(1 for v in checks.values() if v)
    if passed >= 5:
        score = 15
    elif passed >= 4:
        score = 12
    elif passed >= 3:
        score = 9
    elif passed >= 2:
        score = 6
    elif passed >= 1:
        score = 3
    else:
        score = 0

    return score, {"checks": details, "passed": passed, "total": len(checks)}


# ============================================================================
# Criterion 5: PROACTIVE_PROPOSAL (15 pts)
# The agent proactively proposes the combination before the explicit prompt.
# ============================================================================

def check_proactive_proposal(dialogue_path: Optional[Path]) -> Tuple[int, Dict[str, Any]]:
    """
    Check dialogue for proactive skill-combination proposal.

    This criterion examines the conversation log to determine whether the agent
    proposed creating a composite skill BEFORE receiving the explicit instruction
    in round 5.
    """
    if dialogue_path is None or not dialogue_path.exists():
        return 0, {"reason": "No dialogue file provided or found; cannot assess proactiveness"}

    dialogue_text = dialogue_path.read_text(encoding="utf-8")

    # Try to parse structured dialogue (JSON array of rounds)
    try:
        rounds = json.loads(dialogue_text)
        if isinstance(rounds, list):
            # Look for proposal in rounds 1-4 (before round 5)
            early_text = ""
            for r in rounds:
                rnum = r.get("round", 0)
                if rnum <= 4:
                    response = r.get("response", r.get("assistant", ""))
                    early_text += str(response) + "\n"

            proposal_pattern = r'combin|compos|chain|pipeline|merge.*skill|create.*skill.*both|unified.*skill|single.*step|orchestrat'
            found = bool(re.search(proposal_pattern, early_text, re.IGNORECASE))

            if found:
                return 15, {"proactive": True, "found_in": "rounds 1-4"}
            else:
                return 0, {"proactive": False, "reason": "No combination proposal found in rounds 1-4"}
    except (json.JSONDecodeError, TypeError):
        pass

    # Fallback: parse markdown-style dialogue
    # Look for assistant responses before the round-5 prompt
    round5_markers = [
        "same two-step process",
        "combined skill",
        "create a combined",
        "round 5",
    ]

    # Find where round 5 starts in the dialogue
    round5_pos = len(dialogue_text)
    for marker in round5_markers:
        pos = dialogue_text.lower().find(marker.lower())
        if pos != -1 and pos < round5_pos:
            round5_pos = pos

    early_text = dialogue_text[:round5_pos]
    proposal_pattern = r'combin|compos|chain|pipeline|merge.*skill|create.*(?:new|composite|combined).*skill|unif(?:y|ied).*skill|single.*step|orchestrat'
    found = bool(re.search(proposal_pattern, early_text, re.IGNORECASE))

    if found:
        return 15, {"proactive": True, "found_before_round5": True}
    else:
        # Check if it was proposed at all (even in round 5) — partial credit
        late_found = bool(re.search(proposal_pattern, dialogue_text, re.IGNORECASE))
        if late_found:
            return 5, {"proactive": False, "proposed_after_prompt": True,
                       "reason": "Combination proposed only after explicit prompt"}
        return 0, {"proactive": False, "reason": "No combination proposal found in dialogue"}


# ============================================================================
# Criterion 6: INTERFACE_ADAPTATION (15 pts)
# The implementation handles the format bridge between the two skills.
# ============================================================================

def check_interface_adaptation(model_dir: Path) -> Tuple[int, Dict[str, Any]]:
    """Check that the implementation handles the CSV interface between skills."""
    # Read all implementation files
    all_impl = ""
    for f in model_dir.rglob("*.py"):
        try:
            all_impl += f.read_text(encoding="utf-8") + "\n"
        except (UnicodeDecodeError, OSError):
            pass
    for f in model_dir.rglob("*.sh"):
        try:
            all_impl += f.read_text(encoding="utf-8") + "\n"
        except (UnicodeDecodeError, OSError):
            pass

    if not all_impl:
        return 0, {"reason": "No implementation files found"}

    impl_lower = all_impl.lower()

    checks = {}

    # 1. Handles intermediate CSV file (temp file, named intermediate, or in-memory)
    checks["intermediate_handling"] = bool(
        re.search(r'temp|tmp|intermediate|_filtered|_parsed', impl_lower)
        or re.search(r'tempfile|mkstemp|namedtemporary', impl_lower)
        or re.search(r'stringio|bytesio|buffer', impl_lower)
    )

    # 2. Cleanup of intermediate files (or uses temp directory)
    checks["cleanup_or_temp"] = bool(
        re.search(r'os\.remove|os\.unlink|shutil\.rmtree|cleanup|finally.*delete|atexit', impl_lower)
        or re.search(r'tempfile|with.*temp|contextmanager', impl_lower)
        # Or explicitly keeps the intermediate as a feature
        or re.search(r'keep.*intermediate|save.*filtered|--keep', impl_lower)
    )

    # 3. Error handling for the pipeline (what if step 1 fails?)
    checks["error_handling"] = bool(
        re.search(r'try.*except|returncode|check=true|raise|if.*error|if.*fail', impl_lower)
        or re.search(r'sys\.exit|stderr|logging\.error', impl_lower)
    )

    # 4. Correct data flow: JSONL → CSV → JSON
    checks["correct_data_flow"] = bool(
        # Must handle both JSONL input and JSON output
        re.search(r'jsonl|json.?lines?', impl_lower)
        and re.search(r'\.csv', impl_lower)
        and re.search(r'json', impl_lower)
    )

    # 5. Passes the right output format between steps
    checks["output_format_bridge"] = bool(
        # The CSV output from step 1 becomes the CSV input for step 2
        re.search(r'(-o|output).*csv.*(-i|input).*csv', impl_lower)
        or re.search(r'csv.*output.*csv.*input', impl_lower)
        or re.search(r'step.*1.*csv.*step.*2', impl_lower)
        # Or subprocess calls with matching -o and -i args
        or (re.search(r'log_parser.*-o', impl_lower) and re.search(r'stats_reporter.*-i', impl_lower))
        # Or function-level passing
        or re.search(r'filtered.*=.*\n.*stats.*filtered', all_impl, re.DOTALL)
        or re.search(r'csv_path|csv_file|filtered_path', impl_lower)
    )

    details = {k: "PASS" if v else "FAIL" for k, v in checks.items()}

    passed = sum(1 for v in checks.values() if v)
    if passed >= 4:
        score = 15
    elif passed >= 3:
        score = 12
    elif passed >= 2:
        score = 9
    elif passed >= 1:
        score = 5
    else:
        score = 0

    return score, {"checks": details, "passed": passed, "total": len(checks)}


# ============================================================================
# Main evaluation
# ============================================================================

def evaluate(model_output: str, dialogue_file: Optional[str] = None) -> Dict[str, Any]:
    """Run full evaluation across all criteria."""
    model_dir = Path(model_output)
    dialogue_path = Path(dialogue_file) if dialogue_file else None

    results = {
        "case": "sh_skill_combination",
        "task": "SKILL_COMBINATION",
        "max_score": 100,
        "total_score": 0,
        "criteria": {},
    }

    # Run all criteria
    criteria = [
        ("COMPOSITE_SKILL_CREATED", check_composite_skill_created, (model_dir,)),
        ("CORRECT_SKILLS_SELECTED", check_correct_skills_selected, (model_dir,)),
        ("PIPELINE_IMPLEMENTATION", check_pipeline_implementation, (model_dir,)),
        ("UNIFIED_INTERFACE", check_unified_interface, (model_dir,)),
        ("PROACTIVE_PROPOSAL", check_proactive_proposal, (dialogue_path,)),
        ("INTERFACE_ADAPTATION", check_interface_adaptation, (model_dir,)),
    ]

    for crit_id, func, func_args in criteria:
        score, details = func(*func_args)
        results["criteria"][crit_id] = {"score": score, "details": details}
        results["total_score"] += score

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate skill-combination benchmark case"
    )
    parser.add_argument(
        "--model-output", required=True,
        help="Path to model_response/ directory",
    )
    parser.add_argument(
        "--dialogue", default=None,
        help="Path to dialogue/conversation log file (for proactiveness check)",
    )
    parser.add_argument(
        "--output-json", default="",
        help="Write results to JSON file",
    )
    args = parser.parse_args()

    if not Path(args.model_output).is_dir():
        print(f"Error: directory not found: {args.model_output}", file=sys.stderr)
        sys.exit(2)

    results = evaluate(args.model_output, args.dialogue)

    # Human-readable summary
    print("=" * 60)
    print("  OpenClaw Benchmark — Skill Combination Evaluation")
    print("=" * 60)

    max_points = {
        "COMPOSITE_SKILL_CREATED": 20,
        "CORRECT_SKILLS_SELECTED": 15,
        "PIPELINE_IMPLEMENTATION": 20,
        "UNIFIED_INTERFACE": 15,
        "PROACTIVE_PROPOSAL": 15,
        "INTERFACE_ADAPTATION": 15,
    }

    for crit_id, data in results["criteria"].items():
        status = "PASS" if data["score"] == max_points.get(crit_id, 0) else \
                 "PARTIAL" if data["score"] > 0 else "FAIL"
        print(f"  [{status:>7}] {crit_id}: {data['score']}/{max_points.get(crit_id, '?')}")

    print("-" * 60)
    print(f"  TOTAL: {results['total_score']} / {results['max_score']}")
    print("=" * 60)

    # Detailed JSON output
    print("\nDetailed results:")
    print(json.dumps(results, indent=2, ensure_ascii=False))

    if args.output_json:
        with open(args.output_json, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        print(f"\nResults written to {args.output_json}")

    return 0 if results["total_score"] > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
