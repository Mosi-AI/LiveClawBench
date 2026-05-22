#!/usr/bin/env python3
"""
Verifier for release-note-regression-watch.

Checks /workspace/regression_watch.md against the ground-truth delta
between v1.2.0 and v2.0.0 of the Verto release portal.

Ground truth (5 changes):
  1. "Export Reports"        renamed  -> "Export Bundles"
  2. "Legacy CSV Import"     removed
  3. "Multi-tenant Workspaces" renamed -> "Organizations"
  4. "AI Summaries"          demoted  -> Beta
  5. "Weekly Digest Emails"  removed

Marketing contamination check:
  "Verto Copilot" must NOT appear (it is blog-only, not in any release notes).

Scoring:
  1.0 — all 5 checks pass and no marketing contamination
  0.5 — 3 or 4 checks pass (and no contamination)
  0.0 — fewer than 3 checks pass OR marketing contamination present
"""

import json
import re
import sys
from pathlib import Path

WATCHLIST = Path("/home/node/.openclaw/workspace/regression_watch.md")
REWARD_TXT = Path("/logs/verifier/reward.txt")
REWARD_JSON = Path("/logs/verifier/reward.json")

MARKETING_MARKER = "verto copilot"


def _norm(text: str) -> str:
    return text.lower()


def check_ai_summaries_beta(content: str) -> bool:
    """AI Summaries entry must exist AND contain 'beta' nearby."""
    lower = content.lower()
    if "ai summaries" not in lower:
        return False
    # Find the line(s) containing "ai summaries" and check for "beta" in same/adjacent lines
    for line in content.splitlines():
        if "ai summaries" in line.lower() and "beta" in line.lower():
            return True
    # Tolerate "beta" anywhere in the document when "ai summaries" is also present
    return "beta" in lower


def main() -> None:
    if not WATCHLIST.exists():
        score = 0.0
        REWARD_TXT.write_text("0.0\n")
        REWARD_JSON.write_text(
            json.dumps(
                {
                    "reward": score,
                    "_meta_errors": ["regression_watch.md not found in workspace/"],
                }
            )
        )
        print("Score: 0.0/1.0")
        sys.exit(1)

    content = WATCHLIST.read_text(encoding="utf-8", errors="replace")
    lower = _norm(content)
    errors: list[str] = []
    passed: list[str] = []

    # Marketing contamination gate — overrides everything
    if MARKETING_MARKER in lower:
        score = 0.0
        REWARD_TXT.write_text("0.0\n")
        REWARD_JSON.write_text(
            json.dumps(
                {
                    "reward": score,
                    "_meta_errors": [
                        "Watchlist contains 'Verto Copilot' — marketing blog content "
                        "must not be copied into the regression watchlist"
                    ],
                }
            )
        )
        print("Score: 0.0/1.0  (marketing contamination)")
        sys.exit(1)

    # Check 1: "Export Bundles" present AND "Export Reports" absent
    c1 = "export bundles" in lower and "export reports" not in lower
    if c1:
        passed.append("Check 1 PASS: 'Export Reports' renamed to 'Export Bundles'")
    else:
        if "export reports" in lower:
            errors.append(
                "Check 1 FAIL: 'Export Reports' still present "
                "(should be renamed to 'Export Bundles')"
            )
        elif "export bundles" not in lower:
            errors.append(
                "Check 1 FAIL: Neither 'Export Reports' nor 'Export Bundles' found"
            )

    # Check 2: "Legacy CSV Import" absent
    c2 = "legacy csv import" not in lower
    if c2:
        passed.append("Check 2 PASS: 'Legacy CSV Import' correctly removed")
    else:
        errors.append(
            "Check 2 FAIL: 'Legacy CSV Import' still present (removed in v2.0.0)"
        )

    # Check 3: "Organizations" present AND "Multi-tenant Workspaces" absent
    # Accept "multi-tenant workspace" (singular) as well
    has_old = bool(re.search(r"multi.?tenant\s+workspace", lower, re.IGNORECASE))
    c3 = "organizations" in lower and not has_old
    if c3:
        passed.append(
            "Check 3 PASS: 'Multi-tenant Workspaces' renamed to 'Organizations'"
        )
    else:
        if has_old:
            errors.append(
                "Check 3 FAIL: 'Multi-tenant Workspaces' still present "
                "(should be renamed to 'Organizations')"
            )
        elif "organizations" not in lower:
            errors.append(
                "Check 3 FAIL: Neither 'Multi-tenant Workspaces' nor 'Organizations' found"
            )

    # Check 4: "AI Summaries" present AND marked as beta
    c4 = check_ai_summaries_beta(content)
    if c4:
        passed.append("Check 4 PASS: 'AI Summaries' present and marked Beta")
    else:
        if "ai summaries" not in lower:
            errors.append("Check 4 FAIL: 'AI Summaries' entry missing entirely")
        else:
            errors.append(
                "Check 4 FAIL: 'AI Summaries' present but not marked as Beta "
                "(status changed to Beta in v2.0.0)"
            )

    # Check 5: "Weekly Digest Emails" / "Weekly Digest" absent
    c5 = "weekly digest" not in lower
    if c5:
        passed.append("Check 5 PASS: 'Weekly Digest Emails' correctly removed")
    else:
        errors.append("Check 5 FAIL: 'Weekly Digest' still present (removed in v2.0.0)")

    correct = sum([c1, c2, c3, c4, c5])
    if correct == 5:
        score = 1.0
    elif correct >= 3:
        score = 0.5
    else:
        score = 0.0

    REWARD_TXT.write_text(f"{score}\n")
    REWARD_JSON.write_text(
        json.dumps(
            {
                "reward": score,
                "checks_passed": correct,
                "checks_total": 5,
                "_meta_errors": errors,
                "_meta_passed": passed,
            }
        )
    )
    print(f"Score: {score}/1.0  ({correct}/5 checks passed)")
    for msg in passed:
        print(f"  + {msg}")
    for msg in errors:
        print(f"  - {msg}")
    if score < 0.5:
        sys.exit(1)


if __name__ == "__main__":
    main()
