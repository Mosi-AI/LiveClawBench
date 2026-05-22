"""CLI: python -m gol_evolver run --task-id <id> --seed <int> --out <dir>"""

from __future__ import annotations

import argparse
import json
import os
import sys

from gol_evolver.evolver import Evolver
from gol_evolver.report import (
    write_diversity,
    write_evolution_gif,
    write_fitness,
    write_structure_txt,
)
from gol_evolver.rle import encode_rle


def cmd_run(args):
    with open("/workspace/repo/data/tasks.json") as f:
        cfg = json.load(f)
    grid_size = int(cfg["grid_size"])
    tasks = cfg["tasks"]
    task = next((t for t in tasks if t["task_id"] == args.task_id), None)
    if task is None:
        print(f"unknown task_id={args.task_id}", file=sys.stderr)
        return 2

    evo = Evolver(grid_size=grid_size, pop_size=40)
    result = evo.run(task, seed=args.seed, max_generations=task.get("budget_gens", 60))

    os.makedirs(args.out, exist_ok=True)

    # structure.rle + structure.txt
    rle = encode_rle(result["best_grid"])
    with open(os.path.join(args.out, "structure.rle"), "w") as f:
        f.write(rle)
    write_structure_txt(result["best_grid"], os.path.join(args.out, "structure.txt"))

    # results.json
    out = {
        "task_id": args.task_id,
        "seed": args.seed,
        "found": bool(result["found"]),
        "fitness": float(result["best_fitness"]),
        "gens_used": len(result["fitness_history"]),
        "task": result["task"],
    }
    with open(os.path.join(args.out, "results.json"), "w") as f:
        json.dump(out, f, indent=2)

    # viz
    write_fitness(result["fitness_history"], os.path.join(args.out, "fitness.png"))
    write_diversity(result["fitness_history"], os.path.join(args.out, "diversity.png"))
    write_evolution_gif(
        result["best_grid"], os.path.join(args.out, "evolution.gif"), frames=30
    )

    print(
        f"[task {args.task_id} seed={args.seed}] found={out['found']} fitness={out['fitness']:.4f}"
    )
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(prog="gol_evolver")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("run")
    p.add_argument("--task-id", type=int, required=True)
    p.add_argument("--seed", type=int, required=True)
    p.add_argument("--out", required=True)
    p.set_defaults(func=cmd_run)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
