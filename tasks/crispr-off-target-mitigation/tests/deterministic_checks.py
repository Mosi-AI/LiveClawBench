#!/usr/bin/env python3
"""Deterministic pre-checks for research report tasks."""

from pathlib import Path

ROOT = Path.home() / ".openclaw"
OUT = ROOT / "output"
WORK = ROOT / "workspace"

REPORT_CANDIDATES = [
    ROOT / "output" / "report.md",
    ROOT / "workspace" / "output" / "report.md",
]


def find_report() -> Path | None:
    """Locate the agent's report.md output."""
    for candidate in REPORT_CANDIDATES:
        if candidate.is_file():
            return candidate
    return None


def check_report_length(report_path: Path, min_words: int = 500) -> tuple[bool, int]:
    """Return (meets_minimum, word_count)."""
    text = report_path.read_text(encoding="utf-8").strip()
    word_count = len(text.split())
    return word_count >= min_words, word_count
