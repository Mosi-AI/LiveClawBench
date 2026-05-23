"""Verifier for ad-library-snapshot-capture task.

Checks that the agent captured exactly 5 CURRENT creatives (AD001-AD005)
with paired .png + .md files in /home/node/.openclaw/workspace/ad_snapshots/.
"""

import os
import sys

WORKSPACE_DIR = "/home/node/.openclaw/workspace/ad_snapshots"
LOGS_DIR = "/logs/verifier"

ALLOWLIST = {"AD001", "AD002", "AD003", "AD004", "AD005"}
DECOY_SET = {"AD006", "AD007", "AD008"}
REQUIRED_FIELDS = {
    "creative_id",
    "status",
    "headline",
    "campaign_name",
    "start_date",
    "end_date",
    "platform",
}


def parse_metadata(filepath):
    """Parse a .md file line-by-line: split on first ':', strip whitespace, skip empties."""
    fields = {}
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or ":" not in line:
                continue
            idx = line.index(":")
            key = line[:idx].strip()
            value = line[idx + 1 :].strip()
            if key and value:
                fields[key] = value
    return fields


def main():
    os.makedirs(LOGS_DIR, exist_ok=True)

    results = {}
    checks_passed = 0

    # C1: Directory exists
    if not os.path.isdir(WORKSPACE_DIR):
        results["C1"] = False
        _write_reward(0.0, 0, "C1:dir_missing")
        sys.exit(1)
    results["C1"] = True
    checks_passed += 1

    # List all files
    all_files = os.listdir(WORKSPACE_DIR)
    png_files = [f for f in all_files if f.endswith(".png")]
    md_files = [f for f in all_files if f.endswith(".md")]

    png_stems = {os.path.splitext(f)[0] for f in png_files}
    md_stems = {os.path.splitext(f)[0] for f in md_files}

    # C6: Pairing — check before content checks
    if png_stems == md_stems:
        results["C6"] = True
        checks_passed += 1
    else:
        results["C6"] = False

    # C2: File count
    if len(all_files) == 10 and len(png_files) == 5 and len(md_files) == 5:
        results["C2"] = True
        checks_passed += 1
    else:
        results["C2"] = False

    # C3: Correct IDs
    if png_stems == ALLOWLIST:
        results["C3"] = True
        checks_passed += 1
    else:
        results["C3"] = False

    # C4: No contamination
    contaminated = png_stems & DECOY_SET
    if not contaminated:
        results["C4"] = True
        checks_passed += 1
    else:
        results["C4"] = False

    # C5: Metadata completeness
    if results.get("C6") and md_stems:
        all_ok = True
        for stem in sorted(md_stems):
            md_path = os.path.join(WORKSPACE_DIR, f"{stem}.md")
            fields = parse_metadata(md_path)
            # Check all required fields present
            if not REQUIRED_FIELDS.issubset(set(fields.keys())):
                all_ok = False
                break
            # Check status is CURRENT (case-insensitive)
            if fields.get("status", "").upper() != "CURRENT":
                all_ok = False
                break
        results["C5"] = all_ok
        if all_ok:
            checks_passed += 1
    else:
        results["C5"] = False

    # Scoring
    if checks_passed == 6:
        score = 1.0
    elif checks_passed >= 3:
        score = 0.5
    else:
        score = 0.0

    check_details = " ".join(
        f"C{int(k[1])}:{'pass' if v else 'fail'}" for k, v in sorted(results.items())
    )
    _write_reward(score, checks_passed, check_details)

    sys.exit(0 if score >= 0.5 else 1)


def _write_reward(score, checks_passed, details):
    os.makedirs(LOGS_DIR, exist_ok=True)

    reward_txt = os.path.join(LOGS_DIR, "reward.txt")
    with open(reward_txt, "w") as f:
        f.write(str(score))

    import json

    reward_json = os.path.join(LOGS_DIR, "reward.json")
    with open(reward_json, "w") as f:
        json.dump(
            {
                "reward": score,
                "checks_passed": checks_passed,
                "_meta_check_details": details,
            },
            f,
        )


if __name__ == "__main__":
    main()
