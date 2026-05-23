#!/usr/bin/env python3
"""Validate that all LiveClawBench tasks conform to the Harbor task format.

Checks:
  1. Required files exist (task.toml, instruction.md, environment/Dockerfile, tests/test.sh)
  2. TOML content validation (version, metadata fields, sections)
  3. Directory naming convention (##-kebab-case)
  4. Stub detection (warnings for placeholder content)
"""

import re
import sys
import tomllib
from pathlib import Path

TASKS_DIR = Path(__file__).parent.parent / "tasks"
REQUIRED_FILES = [
    "task.toml",
    "instruction.md",
    "environment/Dockerfile",
    "tests/test.sh",
]
VALID_DIFFICULTIES = {"easy", "medium", "hard"}
DIR_NAME_PATTERN = re.compile(r"^[a-z0-9-]+$")
DOMAINS_TOML = Path(__file__).parent.parent / "docs" / "metadata" / "domains.toml"

VALID_DOMAINS = {
    "Browser & Web Scraping",
    "Calendar & Task Mgmt",
    "Coding & Software Dev",
    "Communication & Email",
    "Deep Research & Report",
    "DevOps & Env Repair",
    "Documents & Knowledge",
    "E-commerce & Daily Svcs",
    "Finance & Data Analytics",
    "Health & Fitness",
    "Smart Home",
    "Social Media",
    "Voice & Multimodal",
}
DOMAIN_TO_TAG: dict[str, set[str]] = {
    "Browser & Web Scraping": {"browser_web_scraping"},
    "Calendar & Task Mgmt": {"calendar_task_mgmt"},
    "Coding & Software Dev": {"coding_software_dev"},
    "Communication & Email": {"communication_email"},
    "Deep Research & Report": {"deep_research_report"},
    "DevOps & Env Repair": {"devops_env_repair"},
    "Documents & Knowledge": {"documents_knowledge"},
    "E-commerce & Daily Svcs": {"ecommerce_daily_svcs", "e-commerce_daily_svcs"},
    "Finance & Data Analytics": {"finance"},
    "Health & Fitness": {"health_fitness"},
    "Smart Home": {"smart_home"},
    "Social Media": {"social_media"},
    "Voice & Multimodal": {"voice_multimodal"},
}


def load_canonical_domains() -> set[str]:
    if not DOMAINS_TOML.exists():
        return set()
    data = tomllib.loads(DOMAINS_TOML.read_text())
    return {d["name"] for d in data.get("domain", [])}


def validate_task(
    task_dir: Path, canonical_domains: set[str]
) -> tuple[list[str], list[str]]:
    """Return (errors, warnings) for a task directory."""
    errors: list[str] = []
    warnings: list[str] = []

    # 1. Required files
    for f in REQUIRED_FILES:
        if not (task_dir / f).exists():
            errors.append(f"missing required file: {f}")

    # 2. Directory naming
    if not DIR_NAME_PATTERN.match(task_dir.name):
        errors.append(
            f"directory name '{task_dir.name}' does not match pattern ##-kebab-case"
        )

    # 3. TOML content validation
    toml_path = task_dir / "task.toml"
    if toml_path.exists():
        try:
            data = tomllib.loads(toml_path.read_text(encoding="utf-8"))
        except Exception as e:
            errors.append(f"task.toml parse error: {e}")
            return errors, warnings

        # version
        if data.get("version") != "1.0":
            errors.append("task.toml: version must be '1.0'")

        # [metadata]
        meta = data.get("metadata", {})
        if not meta:
            errors.append("task.toml: [metadata] section missing")
        else:
            # difficulty
            diff = meta.get("difficulty")
            if diff not in VALID_DIFFICULTIES:
                errors.append(
                    f"task.toml: difficulty must be one of {VALID_DIFFICULTIES}, got '{diff}'"
                )

            # case_id
            cid = meta.get("case_id")
            if not isinstance(cid, int) or cid < 1:
                errors.append(
                    f"task.toml: case_id must be a positive integer, got {cid!r}"
                )

            # domain
            if not meta.get("domain"):
                errors.append("task.toml: domain must be non-empty")

            # domain must be in known enum (rule 1.17)
            domain = meta.get("domain")
            if domain and domain not in VALID_DOMAINS:
                errors.append(
                    f"task.toml: domain '{domain}' is not in VALID_DOMAINS ({VALID_DOMAINS})"
                )

            # domains_multi must be in known enum and count must match tags (rule 1.13)
            tags = meta.get("tags", [])
            domains_multi = meta.get("domains_multi", [])

            for idx, dm in enumerate(domains_multi):
                if dm not in VALID_DOMAINS:
                    errors.append(
                        f"task.toml: domains_multi[{idx}] '{dm}' not in VALID_DOMAINS"
                    )

            # tag↔domain canonical mapping check (WARNING only — tolerate
            # legacy spellings and topical tags). zip stops at the shorter
            # list so extra topical tags are silently skipped.
            for idx, (tag, dm) in enumerate(zip(tags, domains_multi)):
                valid_tags = DOMAIN_TO_TAG.get(dm, set())
                if valid_tags and tag not in valid_tags:
                    warnings.append(
                        f"task.toml: tag[{idx}] '{tag}' does not match "
                        f"canonical tags for domain '{dm}' ({valid_tags})"
                    )

            # capability_dimension should NOT exist
            if "capability_dimension" in meta:
                errors.append(
                    "task.toml: capability_dimension is deprecated, remove it"
                )

            # Rule 1.13: tags length must match domains_multi length
            tags = meta.get("tags", [])
            domains_multi = meta.get("domains_multi", [])
            if len(tags) != len(domains_multi):
                errors.append(
                    f"task.toml: len(tags)={len(tags)} != len(domains_multi)={len(domains_multi)}"
                )

            # Rule 1.17: domain enum validation
            if canonical_domains:
                domain = meta.get("domain")
                if domain not in canonical_domains:
                    errors.append(f"task.toml: domain '{domain}' not in canonical enum")
                for dm in domains_multi:
                    if dm not in canonical_domains:
                        errors.append(
                            f"task.toml: domains_multi entry '{dm}' not in canonical enum"
                        )

            # Factor completeness
            for factor in (
                "factor_a1",
                "factor_a2",
                "factor_b1",
                "factor_b2",
                "factor_c1",
                "factor_c2",
            ):
                val = meta.get(factor)
                if val not in (0, 1):
                    errors.append(f"task.toml: {factor} must be 0 or 1, got {val!r}")

        # Required sections
        for section in ("verifier", "agent", "environment"):
            sec = data.get(section)
            if not sec:
                errors.append(f"task.toml: [{section}] section missing")
            elif section in ("verifier", "agent") and "timeout_sec" not in sec:
                errors.append(f"task.toml: [{section}].timeout_sec missing")
            elif section == "environment" and "build_timeout_sec" not in sec:
                errors.append(f"task.toml: [{section}].build_timeout_sec missing")

    # 4. Stub detection (warnings)
    instr_path = task_dir / "instruction.md"
    if instr_path.exists():
        content = instr_path.read_text(encoding="utf-8").strip()
        if len(content) < 50:
            warnings.append("instruction.md: stub content (< 50 chars)")

    test_path = task_dir / "tests" / "test.sh"
    if test_path.exists():
        content = test_path.read_text(encoding="utf-8").strip()
        if content.endswith('echo "PASS"') or content == 'echo "PASS"':
            warnings.append("test.sh: stub test (only echo PASS)")

    solve_path = task_dir / "solution" / "solve.sh"
    if not solve_path.exists():
        warnings.append("solution/solve.sh: no reference solution")

    return errors, warnings


def main() -> int:
    if not TASKS_DIR.exists():
        print(f"ERROR: tasks directory not found: {TASKS_DIR}", file=sys.stderr)
        return 1

    task_dirs = sorted(
        p for p in TASKS_DIR.iterdir() if p.is_dir() and p.name != "common"
    )
    if not task_dirs:
        print("ERROR: no task directories found", file=sys.stderr)
        return 1

    # Global uniqueness check for case_id
    case_ids: dict[int, str] = {}
    all_errors: list[tuple[str, list[str]]] = []
    all_warnings: list[tuple[str, list[str]]] = []

    canonical_domains = load_canonical_domains()

    for task_dir in task_dirs:
        errors, warnings = validate_task(task_dir, canonical_domains)

        # Check case_id uniqueness
        toml_path = task_dir / "task.toml"
        if toml_path.exists():
            try:
                data = tomllib.loads(toml_path.read_text(encoding="utf-8"))
                cid = data.get("metadata", {}).get("case_id")
                if isinstance(cid, int):
                    if cid in case_ids:
                        errors.append(
                            f"task.toml: case_id {cid} duplicates {case_ids[cid]}"
                        )
                    else:
                        case_ids[cid] = task_dir.name
            except Exception:
                pass

        if errors:
            all_errors.append((task_dir.name, errors))
        if warnings:
            all_warnings.append((task_dir.name, warnings))

    total = len(task_dirs)
    err_count = len(all_errors)
    warn_count = sum(len(w) for _, w in all_warnings)

    if all_errors:
        print(f"ERRORS in {err_count}/{total} tasks:\n")
        for name, errors in all_errors:
            print(f"  {name}")
            for e in errors:
                print(f"    ERROR: {e}")
        print()

    if all_warnings:
        print(f"WARNINGS ({warn_count} total):\n")
        for name, warnings in all_warnings:
            print(f"  {name}")
            for w in warnings:
                print(f"    WARN: {w}")
        print()

    passed = total - err_count
    print(f"Result: {passed}/{total} passed, {warn_count} warnings")
    return 1 if all_errors else 0


if __name__ == "__main__":
    sys.exit(main())
