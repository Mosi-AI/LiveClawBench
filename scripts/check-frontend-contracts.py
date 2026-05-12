#!/usr/bin/env python3
"""Static contract checker: frontend property access vs mock response envelopes.

MVP (Phase 1): Grep-based analysis of frontend source files.
Scans tasks/*/environment/*/frontend/src for response access patterns and
compares against known mock envelope shapes.

Known mock auth envelopes:
- email:    POST /api/auth/login -> { success, message, data: { access_token, user } }
- airline:  POST /api/auth/login -> { success, message, data: { access_token, user, refresh_token } }

Usage:
    python scripts/check-frontend-contracts.py
    python scripts/check-frontend-contracts.py --json

Exit codes:
    0 = no contract violations found
    1 = one or more violations found
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
TASKS_DIR = REPO_ROOT / "tasks"

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# response.data.data.property
ACCESS_RE = re.compile(r"response\.data\.data\.([a-zA-Z_]\w*)")

# const { prop1, prop2 } = response.data.data
DESTRUCTURE_RE = re.compile(r"const\s*\{([^}]+)\}\s*=\s*response\.data\.data")

# response.data.data as a whole object (e.g. setUser(response.data.data))
WHOLE_OBJECT_RE = re.compile(r"response\.data\.data\b(?!\.)")

# response.data.property (single-level, e.g. response.data.success)
FLAT_ACCESS_RE = re.compile(r"response\.data\.([a-zA-Z_]\w*)")

# ---------------------------------------------------------------------------
# Known mock envelope shapes (hardcoded for MVP)
# ---------------------------------------------------------------------------

# Map: app_dir_name -> expected nested data properties from auth login response
KNOWN_AUTH_SHAPES = {
    "email-app": {
        "envelope": ["success", "message", "data"],
        "data": ["access_token", "user"],
    },
    "airline-app": {
        "envelope": ["success", "message", "data"],
        "data": ["access_token", "user", "refresh_token"],
    },
    "shop-app": None,  # shop has no auth login endpoint
    "todolist-app": None,  # todolist has no auth login endpoint
    "doc-search-app": None,  # doc-search has no auth login endpoint
}

# ---------------------------------------------------------------------------
# Scanning
# ---------------------------------------------------------------------------


def scan_frontend():
    """Scan all frontend source files and collect access patterns."""
    results = defaultdict(
        lambda: {
            "nested_access": set(),
            "nested_destructure": set(),
            "whole_object_access": False,
            "flat_access": set(),
            "files": set(),
        }
    )

    for frontend_dir in TASKS_DIR.rglob("frontend/src"):
        # Skip node_modules
        if "node_modules" in str(frontend_dir):
            continue

        # Determine app type from grandparent directory name
        # Structure: tasks/<task>/environment/<app-type>/frontend/src
        app_type = frontend_dir.parent.parent.name  # e.g., "email-app", "airline-app"

        for f in frontend_dir.rglob("*"):
            if f.suffix not in {".js", ".jsx", ".ts", ".tsx"}:
                continue
            if "node_modules" in str(f):
                continue

            text = f.read_text(encoding="utf-8")
            relative_path = f.relative_to(REPO_ROOT)

            # Track that this app type has files
            results[app_type]["files"].add(str(relative_path))

            # Find response.data.data.X accesses
            for m in ACCESS_RE.finditer(text):
                results[app_type]["nested_access"].add(m.group(1))

            # Find const { X } = response.data.data destructures
            for m in DESTRUCTURE_RE.finditer(text):
                for prop in m.group(1).split(","):
                    clean = prop.strip().split(":")[0].strip()
                    if clean:
                        results[app_type]["nested_destructure"].add(clean)

            # Find whole-object access: response.data.data (without trailing .prop)
            if WHOLE_OBJECT_RE.search(text):
                results[app_type]["whole_object_access"] = True

            # Find response.data.X flat accesses (excluding "data" itself)
            for m in FLAT_ACCESS_RE.finditer(text):
                prop = m.group(1)
                if prop != "data":
                    results[app_type]["flat_access"].add(prop)

    return results


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------


def analyze(results):
    """Compare scanned patterns against known mock shapes. Return list of violations."""
    violations = []
    warnings = []

    for app_type, data in sorted(results.items()):
        nested = data["nested_access"] | data["nested_destructure"]
        flat = data["flat_access"]
        known = KNOWN_AUTH_SHAPES.get(app_type)

        if known is None:
            # No auth shape known for this app — just report findings
            continue

        expected_data_props = set(known["data"])
        expected_envelope_props = set(known["envelope"])

        # If frontend accesses the whole data object (e.g. response.data.data),
        # consider all nested properties as accessible.
        effective_nested = (
            nested if not data["whole_object_access"] else nested | expected_data_props
        )

        # Check 1: Are expected auth data properties accessed?
        missing = expected_data_props - effective_nested
        if missing:
            violations.append(
                {
                    "app": app_type,
                    "severity": "error",
                    "type": "missing_auth_data_access",
                    "message": f"Frontend never accesses auth data properties: {sorted(missing)}",
                    "expected": sorted(expected_data_props),
                    "found": sorted(nested),
                }
            )

        # Check 2: Are envelope properties (success/message) checked anywhere?
        has_envelope_checks = bool(expected_envelope_props & flat)
        if not has_envelope_checks:
            warnings.append(
                {
                    "app": app_type,
                    "severity": "warning",
                    "type": "no_envelope_check",
                    "message": (
                        "Frontend does not check response envelope properties "
                        f"({sorted(expected_envelope_props)}). "
                        "It may assume all responses are successful."
                    ),
                }
            )

        # Check 3: Are there flat accesses to properties that should be nested?
        # e.g., response.data.access_token instead of response.data.data.access_token
        flat_misplaced = flat & expected_data_props
        if flat_misplaced:
            violations.append(
                {
                    "app": app_type,
                    "severity": "error",
                    "type": "flat_access_when_wrapped",
                    "message": (
                        f"Frontend accesses {sorted(flat_misplaced)} via response.data.X "
                        "but mock returns them under response.data.data.X"
                    ),
                    "properties": sorted(flat_misplaced),
                }
            )

    return violations, warnings


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def report_text(results, violations, warnings):
    print("=" * 70)
    print("Frontend-Mock Contract Check (MVP)")
    print("=" * 70)

    # Summary per app type
    print("\n--- Scanned Apps ---")
    for app_type, data in sorted(results.items()):
        nested = data["nested_access"] | data["nested_destructure"]
        flat = data["flat_access"]
        file_count = len(data["files"])
        print(f"\n{app_type} ({file_count} files)")
        if data["whole_object_access"]:
            print("  Whole-object access (response.data.data): yes")
        if nested:
            print(f"  Nested access (response.data.data.X): {sorted(nested)}")
        if flat:
            print(f"  Flat access (response.data.X):        {sorted(flat)}")
        if not nested and not flat and not data["whole_object_access"]:
            print("  No response.data patterns found")

    # Violations
    if violations:
        print("\n" + "=" * 70)
        print(f"ERRORS ({len(violations)})")
        print("=" * 70)
        for v in violations:
            print(f"\n[{v['app']}] {v['type']}")
            print(f"  {v['message']}")
    else:
        print("\n" + "=" * 70)
        print("No contract violations found.")
        print("=" * 70)

    # Warnings
    if warnings:
        print(f"\nWARNINGS ({len(warnings)})")
        print("-" * 70)
        for w in warnings:
            print(f"\n[{w['app']}] {w['type']}")
            print(f"  {w['message']}")

    # Final verdict
    print("\n" + "=" * 70)
    if violations:
        print("RESULT: FAIL — contract violations detected")
    else:
        print("RESULT: PASS — no contract violations")
    print("=" * 70)


def report_json(results, violations, warnings):
    # Convert sets to lists for JSON serialization
    serializable_results = {}
    for app_type, data in results.items():
        serializable_results[app_type] = {
            "nested_access": sorted(data["nested_access"]),
            "nested_destructure": sorted(data["nested_destructure"]),
            "whole_object_access": data["whole_object_access"],
            "flat_access": sorted(data["flat_access"]),
            "file_count": len(data["files"]),
        }

    output = {
        "results": serializable_results,
        "violations": violations,
        "warnings": warnings,
        "pass": len(violations) == 0,
    }
    print(json.dumps(output, indent=2))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Frontend-Mock Contract Checker")
    parser.add_argument(
        "--json", action="store_true", help="Output JSON instead of text"
    )
    args = parser.parse_args()

    results = scan_frontend()
    violations, warnings = analyze(results)

    if args.json:
        report_json(results, violations, warnings)
    else:
        report_text(results, violations, warnings)

    sys.exit(0 if not violations else 1)


if __name__ == "__main__":
    main()
