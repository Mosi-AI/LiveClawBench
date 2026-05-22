#!/usr/bin/env python3
"""Verifier for ga-gol-persistent-structures.

Pipeline:
  1. Hard gate: imports.
  2. AST surface scan: forbidden imports + required method names.
  3. For each of 3 tasks (seed=0):
       a. Run agent's CLI: python -m gol_evolver run --task-id i --seed 0 --out <d>
       b. Load <d>/structure.rle
       c. Re-verify property using INDEPENDENT sim under /tests/reference_sim/
       Pass = 0.25 each (max 0.75 functional)
  4. Determinism: re-run task 0 seed=0; results.json fitness_history identical (in spirit). +0.10
  5. Viz: all 9 PNG/GIF outputs across 3 tasks present + ≥1KB. +0.15
"""

from __future__ import annotations

import ast
import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path("/workspace/repo")
PKG = REPO / "gol_evolver"
LOG_DIR = Path("/logs/verifier")
ARTIFACTS = Path("/tmp/gol_artifacts")
TASKS_JSON = REPO / "data" / "tasks.json"


FORBIDDEN_TOP = ("deap", "pymoo", "golly", "lifelib")
REQUIRED_METHODS = ("select", "crossover", "mutate")


def emit(score: float, breakdown: dict | None = None, *, reason: str = "") -> None:
    score = max(0.0, min(1.0, score))
    if reason:
        print(reason)
    print(f"Score: {score:.2f}/1.0")
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"reward": round(score, 4)}
    if breakdown:
        payload.update(breakdown)
    (LOG_DIR / "reward.json").write_text(
        json.dumps(payload, indent=2), encoding="utf-8"
    )


def hard_gate() -> tuple[bool, str]:
    cmd = [
        sys.executable,
        "-c",
        "import sys; sys.path.insert(0, '/workspace/repo'); "
        "from gol_evolver import GoL, StructureDetector, Evolver; "
        "assert GoL and StructureDetector and Evolver; print('GATE OK')",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if r.returncode != 0:
        return False, f"hard gate failed:\n{r.stderr[-800:]}"
    return True, ""


def scan_ast() -> tuple[float, list[str]]:
    if not PKG.exists():
        return 0.0, ["gol_evolver/ missing"]
    hits: list[str] = []
    seen_methods: set[str] = set()
    for py in PKG.rglob("*.py"):
        try:
            tree = ast.parse(py.read_text(encoding="utf-8", errors="replace"))
        except SyntaxError as e:
            hits.append(f"{py.relative_to(REPO)}: SyntaxError: {e}")
            continue
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for a in node.names:
                    if a.name.split(".")[0] in FORBIDDEN_TOP:
                        hits.append(f"{py.relative_to(REPO)}: import {a.name}")
            elif isinstance(node, ast.ImportFrom):
                if (node.module or "").split(".")[0] in FORBIDDEN_TOP:
                    hits.append(f"{py.relative_to(REPO)}: from {node.module}")
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if node.name in REQUIRED_METHODS:
                    seen_methods.add(node.name)
    missing = sorted(set(REQUIRED_METHODS) - seen_methods)
    if missing:
        hits.append(f"missing required methods: {missing}")
    if hits:
        print("AST scan hits:")
        for h in hits:
            print(f"  {h}")
        return 0.2, hits
    return 1.0, []


def run_agent(task_id: int, seed: int, out_dir: Path) -> bool:
    out_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        "-m",
        "gol_evolver",
        "run",
        "--task-id",
        str(task_id),
        "--seed",
        str(seed),
        "--out",
        str(out_dir),
    ]
    env = {
        "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
        "PYTHONPATH": "/workspace/repo",
        "HOME": "/root",
    }
    r = subprocess.run(
        cmd, cwd=str(REPO), capture_output=True, text=True, timeout=180, env=env
    )
    if r.returncode != 0:
        print(f"  AGENT FAIL task={task_id} seed={seed}\n    {r.stderr[-400:]}")
        return False
    return True


def load_ref_sim():
    """Dynamically load /tests/reference_sim/gol_sim.py — agent can't reach it."""
    spec = importlib.util.spec_from_file_location(
        "ref_sim", "/tests/reference_sim/gol_sim.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def verify_task(task: dict, struct_rle_path: Path, ref) -> bool:
    if not struct_rle_path.exists():
        print(f"    structure.rle missing: {struct_rle_path}")
        return False
    text = struct_rle_path.read_text()
    try:
        grid = ref.decode_rle(text)
    except Exception as e:  # noqa: BLE001
        print(f"    RLE decode failed: {e}")
        return False
    t = task["type"]
    if t == "oscillator":
        ok = ref.verify_oscillator(
            grid, int(task["target_period"]), int(task["max_steps"])
        )
        print(f"    [verify_oscillator P={task['target_period']}] -> {ok}")
        return bool(ok)
    if t == "spaceship":
        ok, dist = ref.verify_spaceship(
            grid, float(task["min_translation"]), int(task["max_steps"])
        )
        print(
            f"    [verify_spaceship min={task['min_translation']}] dist={dist:.3f} -> {ok}"
        )
        return bool(ok)
    if t == "methuselah":
        ok, lt = ref.verify_methuselah(
            grid, int(task["min_lifetime"]), int(task["max_steps"])
        )
        print(f"    [verify_methuselah T≥{task['min_lifetime']}] lifetime={lt} -> {ok}")
        return bool(ok)
    return False


def grade_functional(tasks: list[dict]) -> tuple[float, list[dict]]:
    if ARTIFACTS.exists():
        shutil.rmtree(ARTIFACTS)
    ARTIFACTS.mkdir(parents=True)
    ref = load_ref_sim()
    results = []
    n_pass = 0
    for task in tasks:
        tid = int(task["task_id"])
        out_dir = ARTIFACTS / f"task{tid}"
        ok_run = run_agent(tid, 0, out_dir)
        ok_verify = False
        if ok_run:
            ok_verify = verify_task(task, out_dir / "structure.rle", ref)
        results.append({"task_id": tid, "ran": ok_run, "verified": ok_verify})
        if ok_verify:
            n_pass += 1
    base = (n_pass / 3.0) * 0.75
    return base, results


def grade_determinism(tasks: list[dict]) -> float:
    """Re-run task 0 seed=0; results.json fitness_history must be identical."""
    first_results = ARTIFACTS / "task0" / "results.json"
    if not first_results.exists():
        return 0.0
    second_dir = ARTIFACTS / "task0_det"
    if not run_agent(0, 0, second_dir):
        return 0.0
    second_results = second_dir / "results.json"
    if not second_results.exists():
        return 0.0
    a = json.loads(first_results.read_text())
    b = json.loads(second_results.read_text())
    if a.get("fitness") == b.get("fitness") and a.get("gens_used") == b.get(
        "gens_used"
    ):
        print("  determinism: OK")
        return 0.10
    print("  determinism: MISMATCH")
    return 0.0


def grade_viz(tasks: list[dict]) -> float:
    needed = ("fitness.png", "diversity.png", "evolution.gif")
    ok_count = 0
    for task in tasks:
        tid = int(task["task_id"])
        d = ARTIFACTS / f"task{tid}"
        if all((d / n).exists() and (d / n).stat().st_size >= 1024 for n in needed):
            ok_count += 1
    return (ok_count / 3.0) * 0.15


def main() -> int:
    print("── ga-gol-persistent-structures verifier ──")

    ok, msg = hard_gate()
    if not ok:
        emit(0.0, reason=msg)
        return 1
    print("Stage 1 hard gate: OK")

    mult, _ = scan_ast()
    print(f"Stage 2 AST scan: multiplier={mult}")

    tasks = json.loads(TASKS_JSON.read_text())["tasks"]
    base, per_task = grade_functional(tasks)
    print(f"Stage 3 functional: base={base:.4f}")

    det = grade_determinism(tasks)
    print(f"Stage 4 determinism: +{det:.4f}")

    viz = grade_viz(tasks)
    print(f"Stage 5 viz: +{viz:.4f}")

    sub_total = base + det + viz
    final = sub_total * mult
    # Harbor's VerifierResult requires `_meta_*` fields to be float|int.
    # Stringify the per_task list via a JSON-encoded debug log instead.
    log_path = LOG_DIR / "per_task.json"
    log_path.write_text(json.dumps(per_task, indent=2), encoding="utf-8")
    breakdown = {
        "functional_base": round(base, 4),
        "determinism": round(det, 4),
        "viz": round(viz, 4),
        "surface_multiplier": mult,
        "_meta_n_tasks_passed": sum(1 for t in per_task if t.get("verified")),
        "_meta_n_tasks_total": len(per_task),
    }
    emit(final, breakdown=breakdown)
    return 0 if final >= 0.5 else 1


if __name__ == "__main__":
    sys.exit(main())
