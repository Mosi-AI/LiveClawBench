from pathlib import Path

OUTPUT_FILE = Path.home() / ".openclaw" / "output" / "reading_order.md"

# Keywords that identify each high-priority file in the ranked list
HIGH_PRIORITY_SIGNALS = [
    # q2_strategic_plan_feedback_deadline.md
    ["q2 strategic plan", "strategic plan feedback", "strategic plan"],
    # vendor_security_advisory_critical.md
    ["security advisory", "vendor security", "cve", "datastream", "security patch"],
    # partnership_nda_term_sheet_draft.md
    ["term sheet", "partnership nda", "nda term", "vertex ai", "due diligence"],
]


def check_output_file() -> float:
    return 1.0 if OUTPUT_FILE.exists() else 0.0


def check_top_items_correct() -> float:
    if not OUTPUT_FILE.exists():
        return 0.0
    content = OUTPUT_FILE.read_text(encoding="utf-8", errors="replace")
    lines = content.splitlines()

    # Extract the first 3 ranked item lines (numbered or bulleted)
    ranked_lines = []
    for ln in lines:
        stripped = ln.strip()
        if stripped and (
            stripped[0].isdigit()
            or stripped.startswith("-")
            or stripped.startswith("*")
        ):
            ranked_lines.append(stripped.lower())
        if len(ranked_lines) >= 3:
            break

    top_3_text = " ".join(ranked_lines)

    found = 0
    for keywords in HIGH_PRIORITY_SIGNALS:
        if any(kw in top_3_text for kw in keywords):
            found += 1

    return found / len(HIGH_PRIORITY_SIGNALS)


def run_checks() -> dict:
    return {
        "output_file_exists": check_output_file(),
        "top_items_correct": check_top_items_correct(),
    }
