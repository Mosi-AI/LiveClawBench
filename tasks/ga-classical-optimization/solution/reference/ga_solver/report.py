"""Visualization helpers for ga_solver runs."""

from __future__ import annotations

import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


def write_fitness_curve(history: list[dict], out_path: str) -> None:
    gens = [h["gen"] for h in history]
    best = [h["best"] for h in history]
    avg = [h["avg"] for h in history]
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(gens, best, label="best", color="C0", linewidth=2)
    ax.plot(gens, avg, label="avg", color="C1", linestyle="--")
    ax.set_xlabel("Generation")
    ax.set_ylabel("Fitness")
    ax.set_title("GA fitness curve")
    ax.legend()
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=100)
    plt.close(fig)


def write_diversity(history: list[dict], out_path: str) -> None:
    gens = [h["gen"] for h in history]
    div = [h["diversity"] for h in history]
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.plot(gens, div, color="C2", linewidth=2)
    ax.set_xlabel("Generation")
    ax.set_ylabel("Diversity (mean |f - f_avg|)")
    ax.set_title("Population diversity")
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=100)
    plt.close(fig)


def write_solution(viz: dict, out_path: str) -> None:
    fig, ax = plt.subplots(figsize=(8, 6))

    if "tour" in viz:
        coords = np.asarray(viz["coords"])
        tour = list(viz["tour"]) + [viz["tour"][0]]
        xs = coords[tour, 0]
        ys = coords[tour, 1]
        ax.plot(xs, ys, "-o", markersize=4, linewidth=1)
        ax.set_title(f"TSP best tour (n={len(viz['tour'])})")
    elif "bits" in viz:
        bits = np.asarray(viz["bits"])
        ax.bar(range(len(bits)), bits * np.asarray(viz["values"]), color="C3")
        ax.set_xlabel("Item index")
        ax.set_ylabel("Value contribution")
        ax.set_title(f"Knapsack chosen items ({bits.sum()}/{len(bits)})")
    elif "x" in viz:
        x = np.asarray(viz["x"])
        ax.bar(range(len(x)), x, color="C4")
        ax.set_xlabel("Dimension")
        ax.set_ylabel("Coordinate")
        ax.set_title(
            f"Continuous best ({viz.get('subtype', '?')} d={viz.get('dim', '?')})"
        )

    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=100)
    plt.close(fig)


def write_all(out_dir: str, history: list[dict], viz: dict) -> None:
    os.makedirs(out_dir, exist_ok=True)
    write_fitness_curve(history, os.path.join(out_dir, "fitness_curve.png"))
    write_diversity(history, os.path.join(out_dir, "diversity.png"))
    write_solution(viz, os.path.join(out_dir, "solution.png"))
