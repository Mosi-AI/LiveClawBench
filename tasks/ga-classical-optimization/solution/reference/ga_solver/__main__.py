"""CLI: python -m ga_solver run --problem <name> --seed <int> --out <dir>"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys

from ga_solver.base import GASolver
from ga_solver.problems import load_fixture, load_problem
from ga_solver.report import write_all

PROBLEM_PARAMS = {
    "tsp30": (150, 80, "tsp30"),  # (max_gens, pop_size, fixture_name)
    "tsp50": (200, 100, "tsp50"),
    "knapsack50": (150, 80, "knapsack50"),
    "schwefel5": (200, 100, "schwefel5"),
    "rastrigin10": (200, 100, "rastrigin10"),
}

# Pass thresholds (must match instruction.md)
THRESHOLDS = {
    # absolute floor on best_fitness. Higher is better. For TSP/Schwefel/Rastrigin
    # we negate the objective so fitness is negative; the threshold is the floor.
    "tsp30": None,  # computed at runtime: -1.30 * ref_optimum
    "tsp50": None,
    "knapsack50": None,  # 0.90 * ref_optimum
    "schwefel5": -500.0,
    "rastrigin10": -50.0,
}


def _compute_threshold(name: str, fixture: dict) -> float:
    if name == "tsp30":
        return -1.50 * float(fixture["ref_optimum"])
    if name == "tsp50":
        return -2.00 * float(fixture["ref_optimum"])
    if name == "knapsack50":
        return 0.90 * float(fixture["ref_optimum"])
    return float(THRESHOLDS[name])


def cmd_run(args: argparse.Namespace) -> int:
    if args.problem not in PROBLEM_PARAMS:
        print(f"unknown problem: {args.problem}", file=sys.stderr)
        return 2

    data_root = "/workspace/repo/data/benchmarks"
    max_gens, pop_size, fixture_name = PROBLEM_PARAMS[args.problem]
    problem = load_problem(fixture_name, data_root)
    fixture = load_fixture(fixture_name, data_root)
    threshold = _compute_threshold(args.problem, fixture)

    solver = GASolver(elite_frac=0.05, tournament_k=3)
    result = solver.run(
        problem, seed=args.seed, max_generations=max_gens, population_size=pop_size
    )

    os.makedirs(args.out, exist_ok=True)

    # results.json
    out_json = {
        "problem": args.problem,
        "seed": args.seed,
        "best_fitness": result["best_fitness"],
        "n_gens_used": len(result["history"]),
        "threshold": threshold,
        "threshold_passed": result["best_fitness"] >= threshold,
        "ref_optimum": fixture["ref_optimum"],
    }
    with open(os.path.join(args.out, "results.json"), "w", encoding="utf-8") as f:
        json.dump(out_json, f, indent=2)

    # history.csv
    with open(
        os.path.join(args.out, "history.csv"), "w", encoding="utf-8", newline=""
    ) as f:
        writer = csv.DictWriter(f, fieldnames=["gen", "best", "avg", "diversity"])
        writer.writeheader()
        for h in result["history"]:
            writer.writerow(h)

    # viz
    viz = problem.encode_for_viz(result["best_individual"])
    write_all(args.out, result["history"], viz)

    print(
        f"[{args.problem} seed={args.seed}] best_fitness={result['best_fitness']:.4f} "
        f"threshold={threshold:.4f} passed={out_json['threshold_passed']}"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ga_solver")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_run = sub.add_parser("run")
    p_run.add_argument("--problem", required=True)
    p_run.add_argument("--seed", type=int, required=True)
    p_run.add_argument("--out", required=True)
    p_run.set_defaults(func=cmd_run)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
