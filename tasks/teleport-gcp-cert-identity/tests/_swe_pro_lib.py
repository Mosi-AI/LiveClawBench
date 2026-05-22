"""Shared utilities for swe-pro-* verifiers (case_id 109-116).

Design notes:
  - Two-tier scoring: try the canonical *gold-overlay* check first (which
    materialises gold-fix-commit's test files on top of agent's tree and runs
    them). If overlay tests can't even compile or yield no test events, fall
    back to *agent's own* tests at a 0.5x cap so that an in-good-faith fix
    that uses different signatures than gold still earns partial credit.
  - find_pytest() probes multiple python interpreters and, as a last resort,
    installs pytest on the fly. This makes the verifier robust to images
    where pip happened to install pytest to a non-system site-packages.
  - stage_agent_changes() runs ``git add -A`` so newly-created files (which
    the agent typically does NOT `git add`) become visible to subsequent
    ``git diff base-commit`` calls. Without this, agents who do the right
    thing by extracting an abstraction into new modules (eg openlibrary's
    metadata_sources/google_books.py) get under-counted by the verifier.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import sys
from pathlib import Path

REPO_DEFAULT = Path("/workspace/repo")


def run(
    cmd, *, cwd: Path = REPO_DEFAULT, timeout: int = 600
) -> subprocess.CompletedProcess:
    return subprocess.run(
        cmd, cwd=str(cwd), capture_output=True, text=True, timeout=timeout
    )


def stage_agent_changes(*, cwd: Path = REPO_DEFAULT) -> None:
    """Stage every working-tree change so ``git diff base-commit`` sees them.

    Why this matters: agents frequently create new files (the openlibrary
    G3-refactor case wrote four NEW ``openlibrary/core/metadata_sources/*.py``
    files) without running ``git add``. Untracked files do NOT appear in
    ``git diff <commit>`` output — the verifier then under-counts the agent's
    work and may incorrectly apply the "agent added no tests" / "agent did
    not touch gold source" penalties.

    Effect after this call:
      - ``git diff base-commit -- <new_path>`` shows the new file as an addition.
      - ``git diff --name-only base-commit`` returns both modified AND added paths.
      - File contents of new files are included in raw ``git diff base-commit`` output,
        so regex scans (eg the openlibrary 3rd-bespoke-branch check) work.

    Side effect: the agent's index becomes "all staged". This is intentional and
    has no downside because the container is ephemeral.
    """
    run(["git", "add", "-A"], cwd=cwd)


def diff_paths(a: str, b: str = "", *, cwd: Path = REPO_DEFAULT) -> list[str]:
    """Return list of paths different between ``a`` (and optional ``b``).

    With one argument, compares the working tree to ``a``; ``stage_agent_changes``
    should be called first so untracked-but-new files are included. With two
    arguments, compares the two commits literally (untracked files irrelevant).
    """
    args = ["git", "diff", "--name-only", a]
    if b:
        args.append(b)
    r = run(args, cwd=cwd)
    return [ln.strip() for ln in r.stdout.splitlines() if ln.strip()]


def find_pytest() -> list[str] | None:
    """Return a `[python, "-m", "pytest"]` cmd or None if pytest unfindable.

    Probes (a) the running python, (b) /usr/bin/python3, (c) `python3` on PATH.
    If none have pytest importable, attempts a `pip install --quiet pytest` and
    re-probes. Returns None if the install also fails.
    """
    candidates = [sys.executable, "/usr/bin/python3", "python3"]
    seen: set[str] = set()
    for py in candidates:
        if not py or py in seen:
            continue
        seen.add(py)
        probe = subprocess.run(
            [py, "-c", "import pytest"], capture_output=True, text=True, timeout=10
        )
        if probe.returncode == 0:
            return [py, "-m", "pytest"]

    # Try to install pytest on the fly.
    install = subprocess.run(
        [
            sys.executable,
            "-m",
            "pip",
            "install",
            "--quiet",
            "--index-url",
            "https://pypi.tuna.tsinghua.edu.cn/simple",
            "pytest",
        ],
        capture_output=True,
        text=True,
        timeout=180,
    )
    if install.returncode == 0:
        probe = subprocess.run(
            [sys.executable, "-c", "import pytest"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        if probe.returncode == 0:
            return [sys.executable, "-m", "pytest"]
    return None


def parse_pytest_summary(text: str) -> tuple[int, int]:
    """Return (passed, failed). Failed includes errors."""
    m = re.search(r"(\d+)\s+passed", text)
    f = re.search(r"(\d+)\s+failed", text)
    e = re.search(r"(\d+)\s+error", text)
    passed = int(m.group(1)) if m else 0
    failed = (int(f.group(1)) if f else 0) + (int(e.group(1)) if e else 0)
    return passed, failed


def parse_go_test_json(stdout: str) -> tuple[int, int, list[str]]:
    """Return (passed, failed, failing_test_names) from `go test -json` stream."""
    import json

    passed = failed = 0
    names: list[str] = []
    for line in stdout.splitlines():
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not ev.get("Test"):
            continue
        if ev.get("Action") == "pass":
            passed += 1
        elif ev.get("Action") == "fail":
            failed += 1
            names.append(f"{ev.get('Package', '?')}::{ev['Test']}")
    return passed, failed, names


def parse_jest_json(json_path: Path, fallback_text: str) -> tuple[int, int]:
    """Return (passed, total) from jest --json output file (or fallback regex)."""
    import json

    try:
        results = json.loads(json_path.read_text())
        return int(results.get("numPassedTests", 0)), int(
            results.get("numTotalTests", 0)
        )
    except (FileNotFoundError, json.JSONDecodeError):
        m = re.search(r"Tests:.*?(\d+)\s+passed.*?(\d+)\s+total", fallback_text)
        if m:
            return int(m.group(1)), int(m.group(2))
    return 0, 0


def overlay_gold_tests(
    is_test_path,
    *,
    cwd: Path = REPO_DEFAULT,
) -> tuple[list[str], dict[str, str]]:
    """Materialise gold-fix-commit's test files onto the working tree.

    Returns (paths_overlaid, originals) where originals[path] is the pre-overlay
    file content (or "" if the path didn't exist). Callers can pass originals
    to ``undo_overlay`` to restore agent's tree if the overlay broke compile.
    """
    overlaid: list[str] = []
    originals: dict[str, str] = {}
    r = run(["git", "diff", "--name-status", "base-commit", "gold-fix-commit"], cwd=cwd)
    for line in r.stdout.splitlines():
        if "\t" not in line:
            continue
        status, _, path = line.partition("\t")
        path = path.strip()
        if not status.strip().startswith(("A", "M")) or not is_test_path(path):
            continue
        show = run(["git", "show", f"gold-fix-commit:{path}"], cwd=cwd)
        if show.returncode != 0:
            continue
        target = cwd / path
        # Save original (if any) so we can roll back on failure.
        if target.exists():
            try:
                originals[path] = target.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                originals[path] = ""
        else:
            originals[path] = ""
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(show.stdout, encoding="utf-8")
        overlaid.append(path)
    return overlaid, originals


def undo_overlay(originals: dict[str, str], *, cwd: Path = REPO_DEFAULT) -> None:
    """Restore files to their pre-overlay state. New files are deleted."""
    for path, content in originals.items():
        target = cwd / path
        if content:
            try:
                target.write_text(content, encoding="utf-8")
            except OSError:
                pass
        else:
            try:
                target.unlink()
            except (FileNotFoundError, OSError):
                pass


def emit(score: float, *, reason: str = "") -> float:
    if reason:
        print(reason)
    score = max(0.0, min(1.0, score))
    print(f"Score: {score:.2f}/1.0")
    return score


def two_tier_score(
    *,
    overlay_pass: int,
    overlay_total: int,
    overlay_compiled: bool,
    agent_pass: int,
    agent_total: int,
    agent_compiled: bool,
    fallback_cap: float = 0.5,
) -> tuple[float, str]:
    """Combine canonical gold-overlay score with agent-own fallback.

    Priority:
      - Gold overlay compiled AND >0 tests ran → use overlay ratio (canonical).
      - Otherwise fall back to ``fallback_cap * agent_ratio`` so partial credit
        is given for agent's own working fix even if it diverges from gold's
        exact interface.
      - Returns 0 only when both paths produce no signal.
    """
    if overlay_compiled and overlay_total > 0:
        return overlay_pass / overlay_total, "gold-overlay"
    if agent_compiled and agent_total > 0:
        return fallback_cap * (
            agent_pass / agent_total
        ), f"agent-own (capped at {fallback_cap:.1f}x)"
    return 0.0, "both tiers failed"


def echo_dual(label: str, passed: int, total: int, ok: bool) -> None:
    status = "ok" if ok else "BUILD FAIL"
    print(f"[{label}] build={status}, tests {passed}/{total}")


def shutil_which(name: str) -> str | None:
    return shutil.which(name)
