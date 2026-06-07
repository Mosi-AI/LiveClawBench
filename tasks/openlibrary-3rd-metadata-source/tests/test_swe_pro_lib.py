"""Unit tests for ``two_tier_score`` in _swe_pro_lib.

The sparse-overlay rescue branch and its threshold constants are
load-bearing scoring decisions across 5 SWE-bench-Pro tasks. These
tests pin the public behaviour so future edits to the rescue
predicate, weight, or threshold trip a CI failure rather than silently
re-shifting scores.

Run with ``pytest tasks/openlibrary-3rd-metadata-source/tests/test_swe_pro_lib.py``.
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _swe_pro_lib import two_tier_score  # noqa: E402


def test_sparse_overlay_rescue_activates() -> None:
    """Single-test overlay + strong agent suite -> rescue at 0.7 x agent_ratio."""
    score, source = two_tier_score(
        overlay_pass=0,
        overlay_total=1,
        overlay_compiled=True,
        agent_pass=13,
        agent_total=15,
        agent_compiled=True,
    )
    assert math.isclose(score, 0.7 * (13 / 15))
    assert "sparse overlay rescue" in source


def test_two_test_overlay_stays_canonical() -> None:
    """A 2-test gold overlay still has signal -> canonical (0/2 = 0.0)."""
    score, source = two_tier_score(
        overlay_pass=0,
        overlay_total=2,
        overlay_compiled=True,
        agent_pass=13,
        agent_total=15,
        agent_compiled=True,
    )
    assert score == 0.0
    assert source == "gold-overlay"


def test_sparse_overlay_pass_uses_canonical() -> None:
    """If the single gold test passes, canonical wins (1/1 = 1.0)."""
    score, source = two_tier_score(
        overlay_pass=1,
        overlay_total=1,
        overlay_compiled=True,
        agent_pass=13,
        agent_total=15,
        agent_compiled=True,
    )
    assert score == 1.0
    assert source == "gold-overlay"


def test_sparse_overlay_weak_agent_no_rescue() -> None:
    """Sparse overlay but agent suite below ratio threshold -> canonical 0/1."""
    score, source = two_tier_score(
        overlay_pass=0,
        overlay_total=1,
        overlay_compiled=True,
        agent_pass=2,
        agent_total=10,
        agent_compiled=True,
    )
    assert score == 0.0
    assert source == "gold-overlay"


def test_sparse_overlay_small_agent_no_rescue() -> None:
    """Agent test count below sparse_agent_min_total -> canonical 0/1."""
    score, source = two_tier_score(
        overlay_pass=0,
        overlay_total=1,
        overlay_compiled=True,
        agent_pass=4,
        agent_total=4,
        agent_compiled=True,
    )
    assert score == 0.0
    assert source == "gold-overlay"


def test_sparse_overlay_zero_agent_total_safe() -> None:
    """``agent_total == 0`` is gated by the sparse_agent_min_total
    predicate (default 5) so the rescue's divide never executes.
    Verify no ZeroDivisionError escapes."""
    score, source = two_tier_score(
        overlay_pass=0,
        overlay_total=1,
        overlay_compiled=True,
        agent_pass=0,
        agent_total=0,
        agent_compiled=True,
    )
    assert score == 0.0
    assert source == "gold-overlay"


def test_no_overlay_falls_back_to_agent() -> None:
    """Overlay didn't compile -> capped agent-own fallback at 0.5x."""
    score, source = two_tier_score(
        overlay_pass=0,
        overlay_total=0,
        overlay_compiled=False,
        agent_pass=8,
        agent_total=10,
        agent_compiled=True,
    )
    assert math.isclose(score, 0.5 * 0.8)
    assert source.startswith("agent-own")


def test_both_tiers_failed_returns_zero() -> None:
    score, source = two_tier_score(
        overlay_pass=0,
        overlay_total=0,
        overlay_compiled=False,
        agent_pass=0,
        agent_total=0,
        agent_compiled=False,
    )
    assert score == 0.0
    assert source == "both tiers failed"
