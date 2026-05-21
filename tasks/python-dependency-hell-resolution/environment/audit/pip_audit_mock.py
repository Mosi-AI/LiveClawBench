#!/usr/bin/env python3
"""Mock pip-audit — reads a curated offline vuln DB and scans a venv.

Usage:
    python3 pip_audit_mock.py /path/to/venv [--format json]

Exits 0 when no HIGH/CRITICAL findings, 1 otherwise.
Prints a JSON report to stdout with {"findings": [...], "counts": {...}}.
"""

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


def parse_constraint(spec: str) -> tuple[str, tuple[int, ...]]:
    """Parse '<1.10.13' or '==3.4.8' → ('<', (1, 10, 13))."""
    m = re.match(r"([<>=!]=?)\s*([\d.]+)", spec.strip())
    if not m:
        raise ValueError(f"unparseable constraint: {spec!r}")
    op = m.group(1)
    parts = tuple(int(x) for x in m.group(2).split("."))
    return op, parts


def cmp_version(a: tuple[int, ...], op: str, b: tuple[int, ...]) -> bool:
    # pad shorter tuple with zeros
    n = max(len(a), len(b))
    a = a + (0,) * (n - len(a))
    b = b + (0,) * (n - len(b))
    if op == "<":
        return a < b
    if op == "<=":
        return a <= b
    if op == ">":
        return a > b
    if op == ">=":
        return a >= b
    if op == "==":
        return a == b
    if op == "!=":
        return a != b
    raise ValueError(f"unknown op {op!r}")


def list_installed(venv: Path) -> dict[str, tuple[int, ...]]:
    pip = venv / "bin" / "pip"
    if not pip.exists():
        print(f"error: no pip in {venv}", file=sys.stderr)
        sys.exit(2)
    out = subprocess.check_output([str(pip), "list", "--format=json"], text=True)
    pkgs = json.loads(out)
    result: dict[str, tuple[int, ...]] = {}
    for p in pkgs:
        name = p["name"].lower().replace("_", "-")
        try:
            parts = tuple(int(x) for x in re.findall(r"\d+", p["version"]))
        except Exception:
            continue
        result[name] = parts
    return result


def scan(venv: Path, db: Path) -> dict:
    installed = list_installed(venv)
    with open(db) as f:
        curated = json.load(f)

    findings = []
    for v in curated["vulns"]:
        pkg = v["package"].lower().replace("_", "-")
        if pkg not in installed:
            continue
        op, target = parse_constraint(v["affected"])
        if cmp_version(installed[pkg], op, target):
            findings.append(
                {
                    "id": v["id"],
                    "package": pkg,
                    "installed": ".".join(str(x) for x in installed[pkg]),
                    "affected": v["affected"],
                    "severity": v["severity"],
                    "summary": v["summary"],
                }
            )

    counts = {
        "CRITICAL": sum(1 for f in findings if f["severity"] == "CRITICAL"),
        "HIGH": sum(1 for f in findings if f["severity"] == "HIGH"),
        "MEDIUM": sum(1 for f in findings if f["severity"] == "MEDIUM"),
        "LOW": sum(1 for f in findings if f["severity"] == "LOW"),
    }
    return {"findings": findings, "counts": counts}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("venv", type=Path)
    ap.add_argument(
        "--db",
        type=Path,
        default=Path("/opt/audit/curated_vulns.json"),
    )
    args = ap.parse_args()

    report = scan(args.venv, args.db)
    print(json.dumps(report, indent=2))
    blocking = report["counts"]["HIGH"] + report["counts"]["CRITICAL"]
    return 1 if blocking > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
