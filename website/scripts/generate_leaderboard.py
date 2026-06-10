"""Generate leaderboard.json and task-results.json from v0.2.0 analysis tables.

Reads:
  - tables/model_summary.csv        → overall scores, run counts
  - tables/model_case_scores_long.csv → per-case run_scores (for best-of-N + per-task results)
  - tables/difficulty_model_scores.csv → per-difficulty breakdown
  - tables/factor_model_scores.csv  → per-factor breakdown
  - tables/domain_model_scores.csv  → per-domain breakdown

Writes:
  - site-data/leaderboard.json
  - site-data/task-results.json  (alongside leaderboard, sibling of --output)
"""

from __future__ import annotations

import argparse
import csv
import json
from datetime import date
from pathlib import Path


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


# Display name overrides applied when reading the analysis tables.
# Keep keys aligned with the raw model identifiers used in the source CSVs.
MODEL_RENAME_MAP: dict[str, str] = {
    "gpt-5.5-medium": "gpt-5.5",
    "qwen3.6-35b-a3b": "qwen3.6-flash",
    "qwen3.5-35b-a3b": "qwen3.5-flash",
}


def rename_model(name: str) -> str:
    return MODEL_RENAME_MAP.get(name, name)


def compute_best_scores(rows: list[dict[str, str]]) -> dict[str, float]:
    """Compute pass@N best score per model.

    For each (model, case) take max(run_scores), then average across cases.
    `run_scores` column is "/"-separated floats like "0/0/1".
    """
    per_model_case_best: dict[str, list[float]] = {}
    for row in rows:
        model = rename_model(row["model"])
        raw = (row.get("run_scores") or "").strip()
        if not raw:
            continue
        try:
            scores = [float(s) for s in raw.split("/") if s != ""]
        except ValueError:
            continue
        if not scores:
            continue
        per_model_case_best.setdefault(model, []).append(max(scores))
    return {
        model: sum(bests) / len(bests)
        for model, bests in per_model_case_best.items()
        if bests
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate leaderboard.json from analysis tables"
    )
    parser.add_argument(
        "--analysis-root",
        type=Path,
        required=True,
        help="Path to analysis_outputs/v0.2.0",
    )
    parser.add_argument(
        "--output", type=Path, required=True, help="Output path for leaderboard.json"
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    tables_dir = args.analysis_root / "tables"

    # ── Read model_summary.csv ──
    summary_rows = read_csv(tables_dir / "model_summary.csv")
    models_data: dict[str, dict] = {}
    for row in summary_rows:
        model = rename_model(row["model"])
        mean_score = float(row["mean_case_avg_at_3"])
        n_runs = int(row["n_runs"])
        n_cases = int(row["n_cases"])
        # runs displayed in the leaderboard = floor(total runs / cases) per the
        # convention "402 runs / 134 cases → 3 attempts per case".
        runs_per_case = n_runs // n_cases if n_cases > 0 else 0
        models_data[model] = {
            "model": model,
            "overall": round(mean_score * 100, 1),
            "bestScore": 0.0,  # filled in below
            "runs": runs_per_case,
            "n_cases": n_cases,
            "difficulty": {},
            "factors": {},
            "domains": {},
        }

    # ── Read model_case_scores_long.csv for pass@N best score ──
    case_rows = read_csv(tables_dir / "model_case_scores_long.csv")
    best_scores = compute_best_scores(case_rows)
    for model, best in best_scores.items():
        if model in models_data:
            models_data[model]["bestScore"] = round(best * 100, 1)

    # ── Read difficulty_model_scores.csv ──
    diff_rows = read_csv(tables_dir / "difficulty_model_scores.csv")
    for row in diff_rows:
        raw_difficulty = row["difficulty"]  # e.g. "calibrated:easy"
        # Only use calibrated difficulty rows (skip registry:E/M/H)
        if not raw_difficulty.startswith("calibrated:"):
            continue
        difficulty = raw_difficulty.split(":")[-1]
        model = rename_model(row["model"])
        mean_score = float(row["mean_model_avg_at_3"])
        if model in models_data:
            models_data[model]["difficulty"][difficulty] = round(mean_score * 100, 1)

    # ── Read factor_model_scores.csv ──
    factor_rows = read_csv(tables_dir / "factor_model_scores.csv")
    for row in factor_rows:
        factor = row["complexity_factor"]
        # Skip "none" pseudo-factor
        if factor == "none":
            continue
        model = rename_model(row["model"])
        mean_score = float(row["mean_model_avg_at_3"])
        if model in models_data:
            models_data[model]["factors"][factor] = round(mean_score * 100, 1)

    # ── Read domain_model_scores.csv ──
    domain_rows = read_csv(tables_dir / "domain_model_scores.csv")
    for row in domain_rows:
        domain = row["domain"]
        model = rename_model(row["model"])
        mean_score = float(row["mean_model_avg_at_3"])
        if model in models_data:
            models_data[model]["domains"][domain] = round(mean_score * 100, 1)

    # ── Rank models by overall score ──
    ranked = sorted(models_data.values(), key=lambda m: m["overall"], reverse=True)
    models_output = []
    for i, m in enumerate(ranked, 1):
        models_output.append(
            {
                "rank": i,
                "model": m["model"],
                "overall": m["overall"],
                "bestScore": m["bestScore"],
                "difficulty": m["difficulty"],
                "factors": m["factors"],
                "domains": m["domains"],
                "runs": m["runs"],
                "coverage": 1.0,
            }
        )

    # ── Build leaderboard.json ──
    leaderboard = {
        "updatedAt": date.today().isoformat(),
        "source": "https://huggingface.co/datasets/Mosi-AI/LiveClawbench-trajectories",
        "scoreScale": "0-100",
        "metrics": [
            "overall",
            "bestScore",
            "easy",
            "medium",
            "hard",
            "A1",
            "A2",
            "B1",
            "B2",
            "C1",
            "C2",
        ],
        "models": models_output,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(leaderboard, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"  ✅ leaderboard.json: {len(models_output)} models ranked")
    print(f"  💾 Written: {args.output}")

    # ── Build task-results.json (per-task model breakdown) ──
    # Schema: { task_name: [{model, avgScore, attempts, allPassed}, ...] }
    # Source: model_case_scores_long.csv (same as bestScore), so model names
    # and the run-pool stay consistent with leaderboard.json.
    task_results: dict[str, list[dict]] = {}
    for row in case_rows:
        case_name = (row.get("case_name") or "").strip()
        if not case_name:
            continue
        model = rename_model(row["model"])
        raw = (row.get("run_scores") or "").strip()
        try:
            scores = [float(s) for s in raw.split("/") if s != ""]
        except ValueError:
            scores = []
        attempts = int(row.get("n_runs") or len(scores))
        if scores:
            avg = round(sum(scores) / len(scores), 3)
            all_passed = all(s >= 1.0 for s in scores)
        else:
            avg = None
            all_passed = False
        task_results.setdefault(case_name, []).append(
            {
                "model": model,
                "avgScore": avg,
                "attempts": attempts,
                "allPassed": all_passed,
            }
        )
    # Sort each task's models by avgScore desc (nulls last) for a stable on-page order.
    for case_name, entries in task_results.items():
        entries.sort(key=lambda e: (e["avgScore"] is None, -(e["avgScore"] or 0)))

    task_results_path = args.output.parent / "task-results.json"
    task_results_path.write_text(
        json.dumps(task_results, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"  ✅ task-results.json: {len(task_results)} tasks")
    print(f"  💾 Written: {task_results_path}")


if __name__ == "__main__":
    main()
