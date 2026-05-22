"""Visualization helpers."""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from gol_evolver.sim import GoL


def write_fitness(history, out_path):
    gens = [h["gen"] for h in history]
    best = [h["best"] for h in history]
    avg = [h["avg"] for h in history]
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.plot(gens, best, label="best", linewidth=2)
    ax.plot(gens, avg, label="avg", linestyle="--")
    ax.set_xlabel("Generation")
    ax.set_ylabel("Fitness")
    ax.legend()
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=100)
    plt.close(fig)


def write_diversity(history, out_path):
    gens = [h["gen"] for h in history]
    div = [h["diversity"] for h in history]
    fig, ax = plt.subplots(figsize=(7, 5))
    ax.plot(gens, div, color="C2", linewidth=2)
    ax.set_xlabel("Generation")
    ax.set_ylabel("Std of fitness")
    ax.grid(alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=100)
    plt.close(fig)


def write_evolution_gif(best_grid: np.ndarray, out_path: str, frames: int = 30) -> None:
    """Run the structure forward `frames` steps and save as GIF."""
    import imageio.v2 as imageio

    images = []
    gol = GoL(best_grid)
    for _ in range(frames):
        g = gol.grid.astype(np.uint8) * 255
        # Upscale 10× for visibility
        img = np.repeat(np.repeat(g, 10, axis=0), 10, axis=1)
        images.append(img)
        gol = gol.step()
    imageio.mimsave(out_path, images, duration=0.1, loop=0)


def write_structure_txt(grid: np.ndarray, out_path: str) -> None:
    with open(out_path, "w") as f:
        for row in grid:
            f.write("".join("O" if c else "." for c in row))
            f.write("\n")
