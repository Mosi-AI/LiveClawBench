#!/usr/bin/env python3
"""
Verification for git-merge-conflict-deploy task (elevated difficulty v2).

Gate checks (all must pass for any score):
  - Merge commit present on main with feature/payment ancestry
  - Feature branch commits visible in main history
  - No conflict markers in source files
  - npm test passes

Scored dimension (1.0 total, only evaluated if all gates pass):
  - merge_report quality at /workspace/output/merge_report.md
    - file_listing   (0.25): identifies which files had conflicts
    - resolution     (0.30): explains how each conflict was resolved
    - rationale      (0.30): explains why, referencing business intent
    - completeness   (0.15): report structure and length
"""

import json
import os
import re
import subprocess
import sys

REPO = "/workspace/webapp"

REPORT_PATH = "/workspace/output/merge_report.md"


def run_cmd(cmd, timeout=30, cwd=None):
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout, cwd=cwd
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -1, "", str(e)


def baseline_guard():
    """Check agent performed merge work."""
    indicators = []

    rc, out, _ = run_cmd("git -C /workspace/webapp log --oneline -10 2>/dev/null")
    if rc == 0:
        lines = [line for line in out.split("\n") if line.strip()]
        if len(lines) > 1:
            indicators.append("git_commits")

    rc, out, _ = run_cmd("git -C /workspace/webapp reflog --oneline -20 2>/dev/null")
    if rc == 0 and ("merge" in out.lower() or "checkout" in out.lower()):
        indicators.append("merge_activity")

    if len(indicators) < 1:
        print("BASELINE GUARD: No agent activity detected")
        print("Score: 0.00/1.0")
        sys.exit(1)

    print(f"BASELINE GUARD: Agent activity confirmed ({indicators})")


# === Gate checks ==============================================================


def gate_merge_commit() -> bool:
    """Require a true merge commit: HEAD has >=2 parents and feature/payment is reachable."""
    rc, out, _ = run_cmd("git cat-file -p HEAD", cwd=REPO)
    if rc != 0:
        print("GATE FAIL [merge_commit]: Could not inspect HEAD")
        return False

    parent_count = out.count("parent ")
    if parent_count < 2:
        print(
            f"GATE FAIL [merge_commit]: HEAD is not a merge commit (parents={parent_count})"
        )
        return False

    rc2, _, _ = run_cmd(
        "git merge-base --is-ancestor "
        "$(git rev-list -n 1 feature/payment 2>/dev/null || "
        "echo 0000000000000000000000000000000000000000) HEAD",
        cwd=REPO,
    )
    if rc2 != 0:
        print("GATE FAIL [merge_commit]: feature/payment not reachable from HEAD")
        return False

    print("GATE PASS [merge_commit]: Merge commit with feature/payment ancestry")
    return True


def gate_feature_history() -> bool:
    """Feature branch commits must be visible in main history (not squashed)."""
    rc, out, _ = run_cmd("git log --oneline main", cwd=REPO)
    if rc != 0:
        print("GATE FAIL [feature_history]: Could not read git log")
        return False

    if "payment" in out.lower():
        print("GATE PASS [feature_history]: feature/payment history in main")
        return True

    cart_path = os.path.join(REPO, "src/cart.js")
    if os.path.exists(cart_path):
        with open(cart_path) as f:
            if "paymentMethod" in f.read():
                print(
                    "GATE FAIL [feature_history]: Payment code present via squash — history not preserved"
                )
                return False

    print("GATE FAIL [feature_history]: feature/payment history not in main")
    return False


def gate_no_conflict_markers() -> bool:
    """No unresolved conflict markers in any source file."""
    src_dir = os.path.join(REPO, "src")
    if not os.path.isdir(src_dir):
        print("GATE FAIL [no_conflicts]: src/ directory not found")
        return False

    for name in os.listdir(src_dir):
        fpath = os.path.join(src_dir, name)
        if os.path.isfile(fpath):
            with open(fpath) as f:
                content = f.read()
            if "<<<<<<<" in content or "=======" in content or ">>>>>>>" in content:
                print(f"GATE FAIL [no_conflicts]: Conflict markers in {name}")
                return False

    print("GATE PASS [no_conflicts]: No conflict markers found")
    return True


def gate_npm_test() -> bool:
    """npm test must pass (zero failures)."""
    rc, out, err = run_cmd("npm test 2>&1", timeout=30, cwd=REPO)
    if rc == 0:
        print("GATE PASS [npm_test]: All tests pass")
        return True

    combined = out + "\n" + err
    if "passed" in combined.lower():
        m = re.search(r"(\d+)\s+passed.*?(\d+)\s+failed", combined)
        if m and int(m.group(2)) == 0:
            print("GATE PASS [npm_test]: All tests pass")
            return True

    print(f"GATE FAIL [npm_test]: Tests failed (rc={rc})")
    return False


# === Scored dimension: merge report ===========================================


def check_merge_report() -> dict[str, float]:
    """Score the merge resolution report (total 1.0).

    Sub-dimensions:
      file_listing   (0.25): identifies conflicting files
      resolution     (0.30): explains how each conflict was resolved
      rationale      (0.30): business intent / why decisions were made
      completeness   (0.15): length, structure, readability
    """
    scores = {
        "file_listing": 0.0,
        "resolution_detail": 0.0,
        "rationale": 0.0,
        "completeness": 0.0,
    }

    report_path = REPORT_PATH
    if not os.path.exists(report_path):
        for p in [
            "/workspace/output/merge-report.md",
            "/workspace/output/report.md",
            "/workspace/merge_report.md",
        ]:
            if os.path.exists(p):
                report_path = p
                break
        else:
            output_dir = "/workspace/output"
            if os.path.isdir(output_dir):
                for fname in os.listdir(output_dir):
                    if fname.endswith(".md"):
                        report_path = os.path.join(output_dir, fname)
                        break
                else:
                    print("SCORED: No merge report found")
                    return scores
            else:
                print("SCORED: No merge report found")
                return scores

    with open(report_path) as f:
        content = f.read()
    content_lower = content.lower()
    word_count = len(content.split())

    if word_count < 30:
        print(f"SCORED: Report too short ({word_count} words)")
        return scores

    # -- 1. File listing (0.25) -----------------------------------------------
    file_refs = set()
    for pattern in [
        r"[\w/]+\.(js|ts|jsx|tsx|json|css|html)",
        r"`[^`]+\.(js|ts|jsx|tsx|json|css|html)`",
    ]:
        file_refs.update(re.findall(pattern, content))

    has_file_section = any(
        kw in content_lower
        for kw in [
            "conflict file",
            "conflicting file",
            "files with conflict",
            "files that had conflict",
            "files contained conflict",
            "conflict in",
            "conflicts in",
        ]
    )

    if has_file_section and len(file_refs) >= 2:
        scores["file_listing"] = 0.25
        print(f"  file_listing: 0.25 (section + {len(file_refs)} file refs)")
    elif len(file_refs) >= 2:
        scores["file_listing"] = 0.18
        print(
            f"  file_listing: 0.18 ({len(file_refs)} file refs, no dedicated section)"
        )
    elif has_file_section:
        scores["file_listing"] = 0.12
        print("  file_listing: 0.12 (section exists, few file refs)")
    elif len(file_refs) >= 1:
        scores["file_listing"] = 0.08
        print("  file_listing: 0.08 (minimal file refs)")
    else:
        print("  file_listing: 0.00 (no conflict files identified)")

    # -- 2. Resolution detail (0.30) ------------------------------------------
    resolution_kw = [
        "resolv",
        "kept",
        "chose",
        "accept",
        "merge",
        "combined",
        "integrated",
        "took.*from",
        "used.*version",
        "manual",
        "pick",
        "retain",
    ]
    res_hits = sum(1 for kw in resolution_kw if re.search(kw, content_lower))

    per_file_patterns = [
        r"###?\s+.*\.(js|ts|jsx|tsx)",
        r"\*\*.*\.(js|ts|jsx|tsx)\*\*",
        r"- .*\.(js|ts|jsx|tsx).*:.*resolv",
    ]
    per_file_hits = sum(
        1 for p in per_file_patterns if re.search(p, content, re.IGNORECASE)
    )

    if res_hits >= 4 and per_file_hits >= 1:
        scores["resolution_detail"] = 0.30
        print(
            f"  resolution_detail: 0.30 ({res_hits} terms, {per_file_hits} per-file blocks)"
        )
    elif res_hits >= 3:
        scores["resolution_detail"] = 0.20
        print(f"  resolution_detail: 0.20 ({res_hits} resolution terms)")
    elif res_hits >= 1:
        scores["resolution_detail"] = 0.10
        print(f"  resolution_detail: 0.10 ({res_hits} resolution terms)")
    else:
        print("  resolution_detail: 0.00 (no resolution descriptions)")

    # -- 3. Rationale (0.30) --------------------------------------------------
    rationale_kw = [
        "because",
        "reason",
        "rationale",
        "business",
        "intent",
        "requirement",
        "goal",
        "purpose",
        "decision",
        "trade-off",
        "tradeoff",
        "priority",
        "stakeholder",
        "feature.*branch",
        "branch.*purpose",
    ]
    rat_hits = sum(1 for kw in rationale_kw if re.search(kw, content_lower))
    has_why = "why" in content_lower
    has_because = "because" in content_lower

    if rat_hits >= 4 and (has_why or has_because):
        scores["rationale"] = 0.30
        print(f"  rationale: 0.30 ({rat_hits} terms)")
    elif rat_hits >= 3:
        scores["rationale"] = 0.22
        print(f"  rationale: 0.22 ({rat_hits} terms)")
    elif rat_hits >= 2:
        scores["rationale"] = 0.15
        print(f"  rationale: 0.15 ({rat_hits} terms)")
    elif rat_hits >= 1:
        scores["rationale"] = 0.08
        print(f"  rationale: 0.08 ({rat_hits} terms)")
    else:
        print("  rationale: 0.00 (no business rationale)")

    # -- 4. Completeness (0.15) -----------------------------------------------
    has_sections = content_lower.count("##") >= 2

    if word_count >= 300 and has_sections:
        scores["completeness"] = 0.15
        print(f"  completeness: 0.15 ({word_count} words, structured)")
    elif word_count >= 200:
        scores["completeness"] = 0.12
        print(f"  completeness: 0.12 ({word_count} words)")
    elif word_count >= 100:
        scores["completeness"] = 0.08
        print(f"  completeness: 0.08 ({word_count} words)")
    else:
        scores["completeness"] = 0.04
        print(f"  completeness: 0.04 ({word_count} words)")

    return scores


def main():
    baseline_guard()

    # === Gate checks ==========================================================
    gate_results = {}
    gate_results["merge_commit"] = gate_merge_commit()
    gate_results["feature_history"] = gate_feature_history()
    gate_results["no_conflicts"] = gate_no_conflict_markers()
    gate_results["npm_test"] = gate_npm_test()

    gates_passed = all(gate_results.values())
    failed_gates = [k for k, v in gate_results.items() if not v]

    if not gates_passed:
        print(f"\nGATE FAILURE: {failed_gates}")
        print("Score: 0.00/1.0")
        os.makedirs("/logs/verifier", exist_ok=True)
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(
                {
                    "reward": 0.0,
                    **{f"gate_{k}": (1 if v else 0) for k, v in gate_results.items()},
                },
                f,
                indent=2,
            )
        sys.exit(1)

    print("\nAll gates passed — scoring merge report...\n")

    # === Scored dimension =====================================================
    report_scores = check_merge_report()
    total = round(sum(report_scores.values()), 2)

    print(f"\nScore: {total:.2f}/1.0")

    os.makedirs("/logs/verifier", exist_ok=True)
    reward_data = {
        "reward": total,
        **{f"gate_{k}": 1 for k in gate_results},
        **{k: round(v, 3) for k, v in report_scores.items()},
    }
    with open("/logs/verifier/reward.json", "w") as f:
        json.dump(reward_data, f, indent=2)

    sys.exit(0 if total >= 0.5 else 1)


if __name__ == "__main__":
    main()
