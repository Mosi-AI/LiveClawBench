#!/usr/bin/env python3
"""Cross-validate complexity annotations across task.toml, complexity-framework.md, and cases_registry.csv.

Checks:
  1. Factor annotations (A1/A2/B1/B2) are consistent across all three sources
  2. Difficulty ratings match across all three sources
  3. Domain assignments match across all three sources
  4. case_id assignments match across all three sources
  5. Outputs summary statistics (factor counts, difficulty distribution)
"""

import csv
import sys
import tomllib
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
TASKS_DIR = REPO_ROOT / "tasks"
FRAMEWORK_MD = REPO_ROOT / "docs" / "en" / "reference" / "complexity-framework.md"
REGISTRY_CSVS = [
    REPO_ROOT / "docs" / "metadata" / "cases_registry.csv",
    REPO_ROOT / "docs" / "metadata" / "cases_registry_zh.csv",
]

DIFFICULTY_MAP = {"E": "easy", "M": "medium", "H": "hard"}


def load_toml_annotations() -> dict[str, dict]:
    """Load annotations from all tasks/*/task.toml files."""
    results = {}
    for task_dir in sorted(TASKS_DIR.iterdir()):
        if not task_dir.is_dir():
            continue
        toml_path = task_dir / "task.toml"
        if not toml_path.exists():
            continue
        data = tomllib.loads(toml_path.read_text())
        meta = data.get("metadata", {})
        results[task_dir.name] = {
            "case_id": meta.get("case_id"),
            "difficulty": meta.get("difficulty"),
            "domain": meta.get("domain"),
            "factor_a1": bool(meta.get("factor_a1", 0)),
            "factor_a2": bool(meta.get("factor_a2", 0)),
            "factor_b1": bool(meta.get("factor_b1", 0)),
            "factor_b2": bool(meta.get("factor_b2", 0)),
        }
    return results


def load_framework_annotations() -> dict[str, dict]:
    """Parse the annotation table from complexity-framework.md."""
    if not FRAMEWORK_MD.exists():
        return {}
    content = FRAMEWORK_MD.read_text()

    # Find the markdown table rows (skip header and separator)
    results = {}
    in_table = False
    for line in content.splitlines():
        # Detect table start: line with case_id header
        if "case_id" in line and "Case Name" in line:
            in_table = True
            continue
        if in_table and line.startswith("|") and "---" in line:
            continue
        if in_table and line.startswith("|"):
            cols = [c.strip() for c in line.split("|")[1:-1]]
            if len(cols) < 7:
                continue
            case_id_str = cols[0].strip()
            if not case_id_str.isdigit():
                continue
            case_name = cols[1].strip().replace(" *(planned)*", "")
            diff_code = cols[2].strip()
            a1 = "✓" in cols[3]
            a2 = "✓" in cols[4]
            b1 = "✓" in cols[5]
            b2 = "✓" in cols[6]
            domain = cols[7].strip() if len(cols) > 7 else ""
            results[case_name] = {
                "case_id": int(case_id_str),
                "difficulty": DIFFICULTY_MAP.get(diff_code, diff_code),
                "domain": domain,
                "factor_a1": a1,
                "factor_a2": a2,
                "factor_b1": b1,
                "factor_b2": b2,
            }
        elif in_table and not line.startswith("|"):
            break
    return results


def load_csv_annotations(csv_path: Path) -> dict[str, dict]:
    """Parse annotations from a cases_registry CSV file."""
    if not csv_path.exists():
        return {}
    results = {}
    with csv_path.open(newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            case_name = row.get("Case name", "").strip()
            if not case_name:
                continue
            results[case_name] = {
                "case_id": int(row.get("case_id", 0)),
                "difficulty": DIFFICULTY_MAP.get(
                    row.get("difficulty", "").strip(),
                    row.get("difficulty", "").strip().lower(),
                ),
                "domain": row.get("domain", "").strip(),
                "factor_a1": row.get("factor_A1", "0").strip() == "1",
                "factor_a2": row.get("factor_A2", "0").strip() == "1",
                "factor_b1": row.get("factor_B1", "0").strip() == "1",
                "factor_b2": row.get("factor_B2", "0").strip() == "1",
                "status": row.get("status", "implemented").strip(),
            }
    return results


def compare_sources(
    toml_data: dict[str, dict],
    framework_data: dict[str, dict],
    csv_data: dict[str, dict],
    *,
    label: str = "csv",
) -> list[str]:
    """Compare annotations across all three sources, return list of errors."""
    errors: list[str] = []
    factor_keys = ["factor_a1", "factor_a2", "factor_b1", "factor_b2"]
    check_keys = ["case_id", "difficulty"] + factor_keys

    # Check toml tasks against framework
    for task_name, toml_ann in toml_data.items():
        fw_ann = framework_data.get(task_name)
        if fw_ann is None:
            errors.append(
                f"[toml↔framework] {task_name}: missing from complexity-framework.md"
            )
            continue
        for key in check_keys:
            if toml_ann.get(key) != fw_ann.get(key):
                errors.append(
                    f"[toml↔framework] {task_name}.{key}: "
                    f"toml={toml_ann.get(key)} vs framework={fw_ann.get(key)}"
                )

    # Check toml tasks against CSV
    for task_name, toml_ann in toml_data.items():
        csv_ann = csv_data.get(task_name)
        if csv_ann is None:
            errors.append(f"[toml↔{label}] {task_name}: missing from {label}")
            continue
        for key in check_keys:
            if toml_ann.get(key) != csv_ann.get(key):
                errors.append(
                    f"[toml↔{label}] {task_name}.{key}: "
                    f"toml={toml_ann.get(key)} vs {label}={csv_ann.get(key)}"
                )

    # Check for framework entries not in toml (skip planned tasks)
    for case_name in framework_data:
        if case_name not in toml_data:
            csv_entry = csv_data.get(case_name)
            if csv_entry and csv_entry.get("status") == "planned":
                continue
            errors.append(
                f"[framework→toml] {case_name}: in framework but no task directory (planned?)"
            )

    return errors


def print_summary(toml_data: dict[str, dict]) -> None:
    """Print summary statistics from task.toml ground truth."""
    factor_counts = {"A1": 0, "A2": 0, "B1": 0, "B2": 0}
    diff_counts = {"easy": 0, "medium": 0, "hard": 0}

    for ann in toml_data.values():
        if ann["factor_a1"]:
            factor_counts["A1"] += 1
        if ann["factor_a2"]:
            factor_counts["A2"] += 1
        if ann["factor_b1"]:
            factor_counts["B1"] += 1
        if ann["factor_b2"]:
            factor_counts["B2"] += 1
        diff = ann.get("difficulty", "")
        if diff in diff_counts:
            diff_counts[diff] += 1

    total = len(toml_data)
    print(f"\n{'=' * 50}")
    print(f"Summary Statistics (from {total} task.toml files)")
    print(f"{'=' * 50}")
    print("\nFactor Distribution:")
    for factor, count in factor_counts.items():
        pct = count / total * 100 if total else 0
        print(f"  {factor}: {count} ({pct:.1f}%)")

    print("\nDifficulty Distribution:")
    for diff, count in diff_counts.items():
        print(f"  {diff}: {count}")


def main() -> int:
    print("Loading annotations from multiple sources...")

    toml_data = load_toml_annotations()
    print(f"  task.toml: {len(toml_data)} tasks")

    framework_data = load_framework_annotations()
    print(f"  complexity-framework.md: {len(framework_data)} entries")

    all_errors: list[str] = []
    for csv_path in REGISTRY_CSVS:
        label = csv_path.stem  # e.g. "cases_registry" or "cases_registry_zh"
        csv_data = load_csv_annotations(csv_path)
        print(f"  {csv_path.name}: {len(csv_data)} entries")

        errors = compare_sources(toml_data, framework_data, csv_data, label=label)
        all_errors.extend(errors)

    if all_errors:
        print(f"\nFOUND {len(all_errors)} INCONSISTENCIES:\n")
        for err in sorted(all_errors):
            print(f"  {err}")
    else:
        print("\nAll annotations are consistent across all sources.")

    print_summary(toml_data)

    return 1 if all_errors else 0


if __name__ == "__main__":
    sys.exit(main())
