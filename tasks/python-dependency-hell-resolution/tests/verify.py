#!/usr/bin/env python3
"""Verifier for python-dependency-hell-resolution.

Scoring (9 dimensions, total 1.0):

  1. Offline install succeeds (clean venv, constraints-honoring)    -> 0.15
  2. All app imports resolve                                         -> 0.10
  3. pytest passes                                                   -> 0.15
  4. Mock pip-audit reports 0 HIGH/CRITICAL                          -> 0.15
  5. No yanked cryptography==3.4.8 reference in any manifest         -> 0.10
  6. Version consistency (fastapi/pydantic/cryptography across files)-> 0.10
  7. Dockerfile uses -c constraints.txt AND forbids --no-deps        -> 0.10
  8. ops-fingerprint preserved in pyproject.toml                     -> 0.05
  9. Structured resolution report covers 6 root causes               -> 0.10

Guard: baseline_guard() requires detectable agent activity.
"""

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

APP = Path("/workspace/app")
WHEELS = Path("/opt/wheels")
AUDIT_DB = Path("/opt/audit/curated_vulns.json")
AUDIT_TOOL = Path("/opt/audit/pip_audit_mock.py")
REPORT_CANDIDATES = [
    Path("/workspace/output/dependency_resolution_report.md"),
    Path("/workspace/app/dependency_resolution_report.md"),
    Path("/workspace/output/resolution_report.md"),
]

FINGERPRINT = "ops-dep-v1-2026-04-17-locked"


def run(cmd, timeout=120, cwd=None, env=None):
    try:
        r = subprocess.run(
            cmd,
            shell=isinstance(cmd, str),
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=cwd,
            env=env,
        )
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -1, "", str(e)


# --- baseline guard -----------------------------------------------------------


def baseline_guard():
    indicators = []
    # Check app dir exists
    if APP.exists():
        indicators.append("app_dir")
    # Any change to requirements / constraints / pyproject / Dockerfile
    for f in ["requirements.txt", "constraints.txt", "pyproject.toml", "Dockerfile"]:
        p = APP / f
        if p.exists() and p.stat().st_size > 0:
            indicators.append(f)
    # Report file
    for p in REPORT_CANDIDATES:
        if p.exists():
            indicators.append("report")
            break
    if len(indicators) < 2:
        print("BASELINE GUARD: No substantive agent activity detected")
        print("Score: 0.00/1.0")
        sys.exit(1)
    print(f"BASELINE GUARD: agent activity = {indicators}")


# --- helpers ------------------------------------------------------------------


def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def find_pins(text: str, pkg: str) -> list[str]:
    """Return every version found next to the given package."""
    out = []
    pat = re.compile(rf"(?mi)^\s*{re.escape(pkg)}\s*([=<>!~]=?|={{2}})\s*([\d.a-z\-]+)")
    for m in pat.finditer(text):
        out.append(m.group(2))
    return out


def parse_version(s: str) -> tuple[int, ...]:
    parts = re.findall(r"\d+", s)
    return tuple(int(x) for x in parts) if parts else (0,)


def cmp_ge(a: str, b: str) -> bool:
    pa, pb = parse_version(a), parse_version(b)
    n = max(len(pa), len(pb))
    pa = pa + (0,) * (n - len(pa))
    pb = pb + (0,) * (n - len(pb))
    return pa >= pb


# --- dimensions ---------------------------------------------------------------


def check_install() -> float:
    """Dim 1: clean-venv offline install honoring constraints. 0.15"""
    req = APP / "requirements.txt"
    cons = APP / "constraints.txt"
    if not (req.exists() and cons.exists()):
        print("[1] FAIL: requirements.txt or constraints.txt missing")
        return 0.0

    with tempfile.TemporaryDirectory() as tmp:
        venv = Path(tmp) / "v"
        rc, _, err = run([sys.executable, "-m", "venv", str(venv)], timeout=60)
        if rc != 0:
            print(f"[1] FAIL: could not create venv: {err[:200]}")
            return 0.0
        pip = venv / "bin" / "pip"
        cmd = [
            str(pip),
            "install",
            "--no-index",
            "--find-links",
            str(WHEELS),
            "-r",
            str(req),
            "-c",
            str(cons),
        ]
        rc, out, err = run(cmd, timeout=180)
        if rc == 0:
            print("[1] PASS: offline install succeeded")
            return 0.15
        tail = (err or out).strip().splitlines()[-5:] if (err or out) else []
        print(f"[1] FAIL: install rc={rc}; tail:\n  " + "\n  ".join(tail))
        return 0.0


def check_imports() -> float:
    """Dim 2: all five imports resolve from a freshly installed venv. 0.10"""
    req = APP / "requirements.txt"
    cons = APP / "constraints.txt"
    if not (req.exists() and cons.exists()):
        return 0.0
    with tempfile.TemporaryDirectory() as tmp:
        venv = Path(tmp) / "v"
        if run([sys.executable, "-m", "venv", str(venv)], timeout=60)[0] != 0:
            print("[2] FAIL: venv create")
            return 0.0
        pip = venv / "bin" / "pip"
        py = venv / "bin" / "python"
        rc, _, err = run(
            [
                str(pip),
                "install",
                "--no-index",
                "--find-links",
                str(WHEELS),
                "-r",
                str(req),
                "-c",
                str(cons),
            ],
            timeout=180,
        )
        if rc != 0:
            print("[2] FAIL: install prerequisite failed")
            return 0.0
        probe = "import fastapi, pydantic, cryptography, orjson, httpx"
        rc, out, err = run([str(py), "-c", probe], timeout=30)
        if rc == 0:
            print("[2] PASS: all 5 imports resolve")
            return 0.10
        print(f"[2] FAIL: import error: {err.strip()[:200]}")
        return 0.0


def check_pytest() -> float:
    """Dim 3: pytest green after installing runtime + dev. 0.15"""
    req = APP / "requirements.txt"
    dev = APP / "requirements-dev.txt"
    cons = APP / "constraints.txt"
    if not req.exists():
        return 0.0
    with tempfile.TemporaryDirectory() as tmp:
        venv = Path(tmp) / "v"
        if run([sys.executable, "-m", "venv", str(venv)], timeout=60)[0] != 0:
            return 0.0
        pip = venv / "bin" / "pip"
        py = venv / "bin" / "python"
        inst = [
            str(pip),
            "install",
            "--no-index",
            "--find-links",
            str(WHEELS),
            "-r",
            str(req),
        ]
        if cons.exists():
            inst += ["-c", str(cons)]
        if dev.exists():
            inst += ["-r", str(dev)]
        rc, _, err = run(inst, timeout=240)
        if rc != 0:
            print(f"[3] FAIL: install prereq failed: {err[:200]}")
            return 0.0
        env = os.environ.copy()
        env["PYTHONPATH"] = str(APP / "src")
        rc, out, err = run(
            [str(py), "-m", "pytest", str(APP / "tests"), "-v"],
            timeout=120,
            env=env,
            cwd=str(APP),
        )
        blob = (out or "") + "\n" + (err or "")
        m_pass = re.search(r"(\d+)\s+passed", blob)
        m_fail = re.search(r"(\d+)\s+failed", blob)
        passed = int(m_pass.group(1)) if m_pass else 0
        failed = int(m_fail.group(1)) if m_fail else 0
        total = passed + failed
        if rc == 0 and passed > 0 and failed == 0:
            print(f"[3] PASS: pytest {passed}/{total} passed")
            return 0.15
        if total > 0:
            ratio = passed / total
            print(f"[3] PARTIAL: pytest {passed}/{total} passed")
            return round(0.15 * ratio, 3)
        print(f"[3] FAIL: pytest collected 0 tests (rc={rc})")
        return 0.0


def check_pip_audit() -> float:
    """Dim 4: installed venv has zero HIGH/CRITICAL per curated DB. 0.15"""
    req = APP / "requirements.txt"
    cons = APP / "constraints.txt"
    if not req.exists():
        return 0.0
    with tempfile.TemporaryDirectory() as tmp:
        venv = Path(tmp) / "v"
        if run([sys.executable, "-m", "venv", str(venv)], timeout=60)[0] != 0:
            return 0.0
        pip = venv / "bin" / "pip"
        inst = [
            str(pip),
            "install",
            "--no-index",
            "--find-links",
            str(WHEELS),
            "-r",
            str(req),
        ]
        if cons.exists():
            inst += ["-c", str(cons)]
        rc, _, _ = run(inst, timeout=180)
        if rc != 0:
            print("[4] FAIL: install prereq failed")
            return 0.0
        rc, out, err = run(
            [sys.executable, str(AUDIT_TOOL), str(venv), "--db", str(AUDIT_DB)],
            timeout=30,
        )
        try:
            report = json.loads(out)
        except json.JSONDecodeError:
            print(f"[4] FAIL: audit tool non-JSON output: {out[:200]}")
            return 0.0
        counts = report.get("counts", {})
        blocking = counts.get("HIGH", 0) + counts.get("CRITICAL", 0)
        if blocking == 0:
            print(f"[4] PASS: pip-audit clean ({counts})")
            return 0.15
        # Partial credit: crude scaled by how many blocking remain
        findings = report.get("findings", [])
        print(
            f"[4] FAIL: {blocking} blocking findings: "
            + ", ".join(f["id"] for f in findings)
        )
        if blocking == 1:
            return 0.05
        return 0.0


def check_no_yanked() -> float:
    """Dim 5: no `cryptography==3.4.8` reference in any manifest. 0.10"""
    bad = "cryptography==3.4.8"
    hits = []
    for name in [
        "requirements.txt",
        "requirements-dev.txt",
        "constraints.txt",
        "pyproject.toml",
        "Dockerfile",
    ]:
        p = APP / name
        if p.exists() and bad in read_text(p):
            hits.append(name)
    if not hits:
        print("[5] PASS: no yanked cryptography==3.4.8 reference")
        return 0.10
    print(f"[5] FAIL: yanked cryptography==3.4.8 still referenced in {hits}")
    return 0.0


def check_version_consistency() -> float:
    """Dim 6: requirements.txt and constraints.txt agree on fastapi/pydantic/cryptography
    at or above the POLICY floors. 0.10"""
    req_text = read_text(APP / "requirements.txt")
    cons_text = read_text(APP / "constraints.txt")
    if not req_text or not cons_text:
        print("[6] FAIL: requirements.txt or constraints.txt missing")
        return 0.0

    floors = {"fastapi": "0.95.0", "pydantic": "1.10.13", "cryptography": "41.0.4"}
    score = 0.0
    for pkg, floor in floors.items():
        r_pins = find_pins(req_text, pkg)
        c_pins = find_pins(cons_text, pkg)
        ok = bool(r_pins) and bool(c_pins)
        if ok:
            ok = all(cmp_ge(v, floor) for v in r_pins + c_pins)
            # Also require consistency between the two files
            ok = ok and set(r_pins) == set(c_pins)
        if ok:
            score += 0.10 / 3
            print(f"[6] {pkg}: consistent & >= {floor} ({r_pins})")
        else:
            print(f"[6] {pkg}: drift (req={r_pins}, cons={c_pins}, floor={floor})")
    score = round(min(score, 0.10), 3)
    print(f"[6] score={score}/0.10")
    return score


def check_dockerfile_policy() -> float:
    """Dim 7: Dockerfile uses -c constraints.txt; no --no-deps. 0.10"""
    p = APP / "Dockerfile"
    if not p.exists():
        print("[7] FAIL: Dockerfile missing")
        return 0.0
    text = read_text(p)
    score = 0.0
    if re.search(r"-c\s+constraints\.txt", text):
        score += 0.05
        print("[7] constraints.txt: honored")
    else:
        print("[7] constraints.txt: NOT honored (missing -c constraints.txt)")
    if "--no-deps" not in text:
        score += 0.05
        print("[7] --no-deps: not used (good)")
    else:
        print("[7] --no-deps: found in Dockerfile (policy violation)")
    return round(score, 3)


def check_fingerprint() -> float:
    """Dim 8: ops-fingerprint preserved in pyproject.toml. 0.05"""
    p = APP / "pyproject.toml"
    if not p.exists():
        print("[8] FAIL: pyproject.toml missing")
        return 0.0
    if FINGERPRINT in read_text(p):
        print("[8] PASS: ops-fingerprint preserved")
        return 0.05
    print(
        f"[8] FAIL: ops-fingerprint '{FINGERPRINT}' missing "
        "(looks like wholesale rewrite)"
    )
    return 0.0


def check_report() -> float:
    """Dim 9: structured JSON report covering 6 root causes. 0.10"""
    report_path = None
    for p in REPORT_CANDIDATES:
        if p.exists():
            report_path = p
            break
    if report_path is None:
        # Fall back: any .md under /workspace/output
        outdir = Path("/workspace/output")
        if outdir.exists():
            for f in outdir.iterdir():
                if f.suffix == ".md":
                    report_path = f
                    break
    if report_path is None:
        print("[9] FAIL: no report file found")
        return 0.0

    text = read_text(report_path)
    # Extract fenced json block
    m = re.search(r"```json\s*\n(.*?)\n```", text, re.DOTALL)
    if not m:
        print("[9] FAIL: no fenced ```json block in report")
        return 0.02
    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError:
        print("[9] FAIL: fenced json block is invalid JSON")
        return 0.02
    rc_list = data.get("root_causes", [])
    if not isinstance(rc_list, list):
        print("[9] FAIL: root_causes is not a list")
        return 0.02
    # Require that the report collectively mentions the 6 known bug surfaces
    bug_surfaces = {
        "fastapi_drift": ["fastapi"],
        "pydantic_cve": ["pydantic"],
        "cryptography_yanked": ["cryptography"],
        "pytest_asyncio_scoping": ["pytest-asyncio", "asyncio", "dev"],
        "dockerfile_constraints": ["constraints", "dockerfile", "-c", "pip"],
        "orjson_missing": ["orjson"],
    }
    joined = json.dumps(data).lower()
    hits = sum(1 for kws in bug_surfaces.values() if any(kw in joined for kw in kws))
    # Weight: each surface = 0.10/6 ≈ 0.0167; award proportional to hits
    score = round(0.10 * hits / 6, 3)
    print(
        f"[9] report covers {hits}/6 bug surfaces (json entries={len(rc_list)}) "
        f"score={score:.3f}"
    )
    return score


# --- main ---------------------------------------------------------------------


def main():
    baseline_guard()

    scores: dict[str, float] = {}
    scores["install"] = check_install()
    scores["imports"] = check_imports()
    scores["pytest"] = check_pytest()
    scores["pip_audit"] = check_pip_audit()
    scores["no_yanked"] = check_no_yanked()
    scores["version_consistency"] = check_version_consistency()
    scores["dockerfile_policy"] = check_dockerfile_policy()
    scores["fingerprint"] = check_fingerprint()
    scores["report"] = check_report()

    total = round(sum(scores.values()), 3)
    print("\n=== Breakdown ===")
    for k, v in scores.items():
        print(f"  {k:22s} {v:.3f}")
    print(f"\nScore: {total:.2f}/1.0")

    try:
        os.makedirs("/logs/verifier", exist_ok=True)
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(
                {
                    "reward": round(total, 2),
                    **{k: round(v, 3) for k, v in scores.items()},
                },
                f,
                indent=2,
            )
    except Exception:
        pass

    sys.exit(0 if total >= 0.5 else 1)


if __name__ == "__main__":
    main()
