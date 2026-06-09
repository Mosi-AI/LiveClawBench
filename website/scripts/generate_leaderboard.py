"""Generate leaderboard.json from v0.2.0 analysis tables.

Reads:
  - tables/model_summary.csv        → overall scores, run counts
  - tables/difficulty_model_scores.csv → per-difficulty breakdown
  - tables/factor_model_scores.csv  → per-factor breakdown
  - tables/domain_model_scores.csv  → per-domain breakdown

Writes:
  - site-data/leaderboard.json (same schema as existing)
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
        model = row["model"]
        mean_score = float(row["mean_case_avg_at_3"])
        n_runs = int(row["n_runs"])
        n_cases = int(row["n_cases"])
        models_data[model] = {
            "model": model,
            "overall": round(mean_score * 100, 1),
            "runs": n_runs,
            "n_cases": n_cases,
            "difficulty": {},
            "factors": {},
            "domains": {},
        }

    # ── Read difficulty_model_scores.csv ──
    diff_rows = read_csv(tables_dir / "difficulty_model_scores.csv")
    for row in diff_rows:
        raw_difficulty = row["difficulty"]  # e.g. "calibrated:easy"
        # Only use calibrated difficulty rows (skip registry:E/M/H)
        if not raw_difficulty.startswith("calibrated:"):
            continue
        difficulty = raw_difficulty.split(":")[-1]
        model = row["model"]
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
        model = row["model"]
        mean_score = float(row["mean_model_avg_at_3"])
        if model in models_data:
            models_data[model]["factors"][factor] = round(mean_score * 100, 1)

    # ── Read domain_model_scores.csv ──
    domain_rows = read_csv(tables_dir / "domain_model_scores.csv")
    for row in domain_rows:
        domain = row["domain"]
        model = row["model"]
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


if __name__ == "__main__":
    main()
