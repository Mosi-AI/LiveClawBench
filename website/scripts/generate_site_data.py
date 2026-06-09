"""Generate site-data files from worktree sources.

Produces:
  - tasks.json          (from cases_registry + task dirs)
  - metrics-summary.json (derived from tasks.json)
  - domains.toml        (copy from worktree)
  - mock-apps.json      (from task-binary-map.json)

Usage:
  python generate_site_data.py --worktree /path/to/worktree --output /path/to/site-data
"""

from __future__ import annotations
import argparse
import csv
import json
import re
from collections import defaultdict
from datetime import date
from pathlib import Path


# ─── TOML parser (flat + single-level tables, matching task.toml format) ──────

def parse_toml(text: str) -> dict:
    root: dict = {}
    current = root

    for raw_line in text.split("\n"):
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        # [section]
        section_match = re.match(r"^\[(\w+)\]$", line)
        if section_match:
            name = section_match.group(1)
            current = {}
            root[name] = current
            continue

        # key = value
        kv_match = re.match(r"^(\w+)\s*=\s*(.+)$", line)
        if kv_match:
            key = kv_match.group(1)
            val = kv_match.group(2).strip()
            # strip inline comment
            val = re.sub(r"\s+#\s+.*$", "", val).strip()

            # array
            if val.startswith("["):
                inner = val[1:-1].strip()
                if not inner:
                    current[key] = []
                else:
                    current[key] = [s.strip().strip('"') for s in inner.split(",")]
                continue

            # boolean
            if val == "true":
                current[key] = True
                continue
            if val == "false":
                current[key] = False
                continue

            # number
            if re.match(r"^-?\d+(\.\d+)?$", val):
                current[key] = float(val) if "." in val else int(val)
                continue

            # string
            current[key] = val.strip('"')

    return root


# ─── CSV parser ───────────────────────────────────────────────────────────────

def read_csv_file(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


# ─── Main generation logic ────────────────────────────────────────────────────

def generate_tasks(worktree: Path, output: Path) -> list[dict]:
    """Generate tasks.json and metrics-summary.json."""
    registry_zh_path = worktree / "docs" / "metadata" / "cases_registry_zh.csv"
    registry_en_path = worktree / "docs" / "metadata" / "cases_registry.csv"
    tasks_dir = worktree / "tasks"
    binary_map_path = worktree / "mock-platform" / "config" / "task-binary-map.json"

    # Read registries
    zh_rows = read_csv_file(registry_zh_path)
    en_rows = read_csv_file(registry_en_path)
    print(f"  cases_registry_zh.csv: {len(zh_rows)} rows")
    print(f"  cases_registry.csv: {len(en_rows)} rows")

    # English description map
    desc_en_map = {}
    for row in en_rows:
        name = (row.get("Case name") or "").strip()
        desc = (row.get("description") or "").strip()
        if name and desc:
            desc_en_map[name] = desc

    # Task-binary-map
    binary_map: dict = {}
    if binary_map_path.exists():
        data = json.loads(binary_map_path.read_text(encoding="utf-8"))
        binary_map = data.get("tasks", {})
        print(f"  task-binary-map.json: {len(binary_map)} task entries")
    else:
        print("  ⚠️  task-binary-map.json not found, mock_apps will be empty")

    difficulty_map = {"E": "easy", "M": "medium", "H": "hard"}
    tasks = []

    for row in zh_rows:
        case_name = (row.get("Case name") or "").strip()
        if not case_name:
            continue
        status = (row.get("status") or "").strip()
        if status and status != "implemented":
            continue

        case_id = int(row.get("case_id", "0").strip() or "0")
        diff_raw = (row.get("difficulty") or "").strip()
        difficulty = difficulty_map.get(diff_raw, diff_raw.lower() or "unknown")
        domain = (row.get("domain") or "").strip()
        domains_multi_str = (row.get("domains_multi") or "").strip()
        description_zh = (row.get("description") or "").strip()
        description_en = desc_en_map.get(case_name, "")

        domains_multi = (
            [s.strip() for s in domains_multi_str.split(";") if s.strip()]
            if domains_multi_str
            else ([domain] if domain else [])
        )

        factors = {
            "A1": row.get("factor_A1", "").strip() == "1",
            "A2": row.get("factor_A2", "").strip() == "1",
            "B1": row.get("factor_B1", "").strip() == "1",
            "B2": row.get("factor_B2", "").strip() == "1",
            "C1": row.get("factor_C1", "").strip() == "1",
            "C2": row.get("factor_C2", "").strip() == "1",
        }

        # Read instruction.md
        instruction = ""
        instr_path = tasks_dir / case_name / "instruction.md"
        if instr_path.exists():
            instruction = instr_path.read_text(encoding="utf-8").strip()

        # Read task.toml
        toml_data: dict = {}
        toml_path = tasks_dir / case_name / "task.toml"
        if toml_path.exists():
            toml_data = parse_toml(toml_path.read_text(encoding="utf-8"))

        meta = toml_data.get("metadata", {})
        verifier_cfg = toml_data.get("verifier", {})
        agent_cfg = toml_data.get("agent", {})
        environment_cfg = toml_data.get("environment", {})

        # mock_apps from binary map
        task_binary = binary_map.get(case_name, {})
        mock_apps = task_binary.get("binaries", []) if isinstance(task_binary, dict) else []
        has_frontend = bool(task_binary.get("frontends")) if isinstance(task_binary, dict) else False

        # Verifier type from tests/test.sh
        verifier_type = ""
        test_sh_path = tasks_dir / case_name / "tests" / "test.sh"
        if test_sh_path.exists():
            content = test_sh_path.read_text(encoding="utf-8")
            if "llm_judge.py" in content:
                verifier_type = "llm_judge.py"
            elif "evaluate.py" in content:
                verifier_type = "evaluate.py"
            elif "verify.py" in content:
                verifier_type = "verify.py"

        task_entry = {
            "case_id": case_id,
            "name": case_name,
            "difficulty": difficulty,
            "domain": domain,
            "domains_multi": domains_multi,
            "factors": factors,
            "instruction": instruction,
            "description_zh": description_zh,
            "description_en": description_en,
            "mock_apps": mock_apps,
            "has_frontend": has_frontend,
            "status": status or "implemented",
            "category": meta.get("category", ""),
            "tags": meta.get("tags", []),
            "verifier_type": verifier_type,
            "verifier": {"timeout_sec": verifier_cfg.get("timeout_sec", 900)},
            "agent": {"timeout_sec": agent_cfg.get("timeout_sec", 1800)},
            "environment": {
                "build_timeout_sec": environment_cfg.get("build_timeout_sec", 600),
                "cpus": environment_cfg.get("cpus", 2),
                "memory_mb": environment_cfg.get("memory_mb", 4096),
                "storage_mb": environment_cfg.get("storage_mb", 10240),
                "allow_internet": environment_cfg.get("allow_internet", True),
            },
            "paths": {
                "task_toml": f"tasks/{case_name}/task.toml",
                "instruction": f"tasks/{case_name}/instruction.md",
                "environment": f"tasks/{case_name}/environment/Dockerfile",
                "test_sh": f"tasks/{case_name}/tests/test.sh",
            },
            "version": "1.0",
        }
        tasks.append(task_entry)

    tasks.sort(key=lambda t: t["case_id"])
    print(f"  ✅ tasks.json: {len(tasks)} tasks")

    # Write tasks.json
    tasks_path = output / "tasks.json"
    tasks_path.write_text(json.dumps({"tasks": tasks}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  💾 Written: {tasks_path}")

    # ── Generate metrics-summary.json ──
    total_tasks = len(tasks)
    difficulty_dist: dict[str, int] = {"easy": 0, "medium": 0, "hard": 0}
    domain_dist: dict[str, int] = defaultdict(int)
    factor_dist: dict[str, int] = {"A1": 0, "A2": 0, "B1": 0, "B2": 0, "C1": 0, "C2": 0}
    factor_overlap_dist: dict[str, int] = {"0 factors": 0, "1 factor": 0, "2 factors": 0, "3 factors": 0, "4+ factors": 0}
    verifier_dist: dict[str, int] = defaultdict(int)

    for t in tasks:
        d = t["difficulty"]
        if d in difficulty_dist:
            difficulty_dist[d] += 1

        domain_dist[t["domain"]] += 1

        enabled = sum(1 for v in t["factors"].values() if v)
        for factor_name, factor_val in t["factors"].items():
            if factor_val:
                factor_dist[factor_name] += 1

        if enabled == 0:
            factor_overlap_dist["0 factors"] += 1
        elif enabled == 1:
            factor_overlap_dist["1 factor"] += 1
        elif enabled == 2:
            factor_overlap_dist["2 factors"] += 1
        elif enabled == 3:
            factor_overlap_dist["3 factors"] += 1
        else:
            factor_overlap_dist["4+ factors"] += 1

        if t["verifier_type"]:
            verifier_dist[t["verifier_type"]] += 1

    # Sort domain dist by count descending
    sorted_domain = dict(sorted(domain_dist.items(), key=lambda x: x[1], reverse=True))

    metrics = {
        "updatedAt": date.today().isoformat(),
        "totalTasks": total_tasks,
        "difficultyDistribution": difficulty_dist,
        "domainDistribution": sorted_domain,
        "factorDistribution": factor_dist,
        "factorOverlapDistribution": factor_overlap_dist,
        "verifierTypeDistribution": dict(verifier_dist),
    }

    metrics_path = output / "metrics-summary.json"
    metrics_path.write_text(json.dumps(metrics, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  ✅ metrics-summary.json: totalTasks={total_tasks}")
    print(f"  💾 Written: {metrics_path}")

    return tasks


def generate_domains(worktree: Path, output: Path) -> None:
    """Copy domains.toml from worktree."""
    src = worktree / "docs" / "metadata" / "domains.toml"
    dst = output / "domains.toml"
    if src.exists():
        dst.write_text(src.read_text(encoding="utf-8"), encoding="utf-8")
        print("  ✅ domains.toml copied")
        print(f"  💾 Written: {dst}")
    else:
        print(f"  ⚠️  domains.toml not found at {src}")


def generate_mock_apps(worktree: Path, output: Path) -> None:
    """Generate mock-apps.json from task-binary-map.json."""
    binary_map_path = worktree / "mock-platform" / "config" / "task-binary-map.json"
    if not binary_map_path.exists():
        print("  ⚠️  task-binary-map.json not found, skipping mock-apps.json")
        return

    data = json.loads(binary_map_path.read_text(encoding="utf-8"))
    binaries: list[str] = data.get("binaries", [])

    # Try to read README for summaries
    summary_map: dict[str, str] = {}
    readme_path = worktree / "mock-platform" / "README.md"
    if readme_path.exists():
        readme_text = readme_path.read_text(encoding="utf-8")
        summary_map = _parse_mock_services_table(readme_text)

    mock_apps = []
    for binary_name in binaries:
        mock_apps.append({
            "id": binary_name,
            "name": binary_name,
            "summary": summary_map.get(binary_name, ""),
            "mainScreens": [],
            "agentActions": [],
            "demoGif": None,
            "previewAssets": [],
            "sourceFiles": [
                "mock-platform/config/task-binary-map.json",
                "mock-platform/README.md",
            ],
        })

    dst = output / "mock-apps.json"
    dst.write_text(json.dumps({"mockApps": mock_apps}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"  ✅ mock-apps.json: {len(mock_apps)} mock apps")
    print(f"  💾 Written: {dst}")


def _parse_mock_services_table(readme: str) -> dict[str, str]:
    """Parse ## Mock Services table from README to extract dirname → description."""
    result: dict[str, str] = {}
    in_section = False
    table_started = False

    for line in readme.split("\n"):
        stripped = line.strip()
        if re.match(r"^##\s+Mock\s+Services", stripped):
            in_section = True
            continue
        if in_section and re.match(r"^##\s+", stripped):
            break
        if not in_section:
            continue
        if not stripped.startswith("|"):
            continue

        if "Service" in stripped and "Description" in stripped:
            table_started = True
            continue
        if re.match(r"^\|[\s\-:|]+\|$", stripped):
            continue
        if not table_started:
            continue

        cells = [c.strip() for c in stripped.split("|")]
        cells = [c for c in cells if c]  # remove empty from leading/trailing |

        if len(cells) >= 4:
            directory_raw = cells[1].replace("`", "")
            description = cells[3]
            parts = [p for p in directory_raw.split("/") if p]
            dirname = parts[-1] if len(parts) >= 2 else (parts[0] if parts else "")
            if dirname:
                result[dirname] = description

    return result


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate site-data from worktree")
    parser.add_argument("--worktree", type=Path, required=True, help="Path to worktree root")
    parser.add_argument("--output", type=Path, required=True, help="Output directory (site-data/)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    print("── Generating tasks.json + metrics-summary.json ──")
    generate_tasks(args.worktree, args.output)

    print("")
    print("── Generating domains.toml ──")
    generate_domains(args.worktree, args.output)

    print("")
    print("── Generating mock-apps.json ──")
    generate_mock_apps(args.worktree, args.output)


if __name__ == "__main__":
    main()
