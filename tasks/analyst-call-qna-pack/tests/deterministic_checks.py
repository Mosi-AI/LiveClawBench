#!/usr/bin/env python3
"""Deterministic pre-checks for analyst-call-qna-pack."""

import re
from pathlib import Path

ROOT = Path.home() / ".openclaw"
OUT = ROOT / "output"
OUTPUT_PATH = OUT / "analyst_qna.md"
CALENDAR_DB = Path("/var/lib/mock-data/calendar/calendar.db")


def load_output() -> str:
    if not OUTPUT_PATH.exists():
        return ""
    try:
        return OUTPUT_PATH.read_text(encoding="utf-8")
    except OSError:
        return ""


def check_file_exists(text: str) -> dict[str, float]:
    return {"file_exists": 1.0 if text.strip() else 0.0}


def check_qa_count(text: str) -> dict[str, float]:
    # Count Q&A pairs. The task only requires 8 analyst questions — no specific
    # prefix is mandated — so accept any of these formats:
    #   - Explicit Q: prefix: "### Q:", "**Q:**", "Q1:"
    #   - Heading ending with "?": "### How did NXL-7 perform?"
    #   - Bold ending with "?": "**What is the guidance?**"
    #   - Numbered item ending with "?": "1. What is the revenue?"
    patterns = [
        r"^#{1,3}\s+Q[:\.]",
        r"^\*\*Q[:\.]",
        r"^Q\d*[:\.]",
        r"^#{1,3}\s+.+\?",
        r"^\*\*.+\?\*\*",
        r"^\d+[.)]\s+.+\?",
    ]
    count = 0
    for line in text.splitlines():
        line = line.strip()
        for pat in patterns:
            if re.match(pat, line, re.IGNORECASE):
                count += 1
                break
    return {"qa_count_ok": 1.0 if count >= 8 else round(count / 8, 2)}


def check_risk_topics(text: str) -> dict[str, float]:
    # Look for a "Risk Topics" section with at least 3 numbered/bulleted items
    lower = text.lower()
    risk_idx = lower.find("risk topic")
    if risk_idx == -1:
        return {"risk_topics_ok": 0.0}
    # Count items in the section (numbered or bulleted lines)
    section = text[risk_idx:]
    # Stop at next ## heading
    next_section = re.search(r"\n##\s+", section)
    if next_section:
        section = section[: next_section.start()]
    items = re.findall(r"^\s*(?:[-*]|\d+[.)])\s+\S", section, re.MULTILINE)
    count = len(items)
    return {"risk_topics_ok": 1.0 if count >= 3 else round(count / 3, 2)}


def check_do_not_say(text: str) -> dict[str, float]:
    lower = text.lower()
    dns_idx = lower.find("do not say")
    if dns_idx == -1:
        return {"do_not_say_ok": 0.0}
    section = text[dns_idx:]
    next_section = re.search(r"\n##\s+", section)
    if next_section:
        section = section[: next_section.start()]
    items = re.findall(r"^\s*(?:[-*]|\d+[.)])\s+\S", section, re.MULTILINE)
    count = len(items)
    return {"do_not_say_ok": 1.0 if count >= 3 else round(count / 3, 2)}


def _get_seeded_event_date() -> str:
    """Return YYYY-MM-DD of the seeded NXL event from the calendar DB, or '' if unavailable."""
    if not CALENDAR_DB.exists():
        return ""
    try:
        import sqlite3

        conn = sqlite3.connect(str(CALENDAR_DB))
        rows = conn.execute(
            "SELECT start_time FROM calendar_event WHERE title LIKE '%NXL%' LIMIT 1"
        ).fetchall()
        conn.close()
        if rows:
            return rows[0][0][:10]  # "YYYY-MM-DD" from "YYYY-MM-DDTHH:MM:SS"
    except Exception:
        pass
    return ""


def check_call_details(text: str) -> dict[str, float]:
    """Check that the ## Call Details section contains the meeting time AND the actual seeded date."""
    section = re.search(r"(?i)^##\s*call\s*details", text, re.MULTILINE)
    if not section:
        return {"call_details_ok": 0.0}
    content_start = section.end()
    next_heading = re.search(r"\n##\s+", text[content_start:])
    section_text = text[
        content_start : content_start
        + (next_heading.start() if next_heading else len(text))
    ]
    # Require the specific meeting start time (14:00 / 2 PM) — fixed in startup.sh.
    has_meeting_time = bool(
        re.search(r"14:00|2:00\s*[Pp][Mm]|2\s*[Pp][Mm]\b", section_text)
    )
    if not has_meeting_time:
        return {"call_details_ok": 0.0}
    # Also require the run-specific Thursday date from the DB.
    # The date changes each benchmark run; an agent that hardcodes only the fixed time
    # but not the correct date cannot have used the calendar API.
    seeded_date = _get_seeded_event_date()
    if seeded_date and seeded_date not in section_text:
        return {"call_details_ok": 0.0}
    return {"call_details_ok": 1.0}


def check_a2_corrections(text: str) -> dict[str, float]:
    """Check that outdated Q2 figures are replaced with Q3 figures."""
    scores: dict[str, float] = {}
    lower = text.lower()

    # A2 check 1: Q3 NXL-7 product revenue $41.6M should appear (corrects Q2 $31.8M in the draft)
    scores["a2_revenue_updated"] = 1.0 if "41.6" in text else 0.0

    # A2 check 2: Updated guidance $210–220M should appear (not old $190–205M)
    scores["a2_guidance_updated"] = 1.0 if ("210" in text or "220" in text) else 0.0

    # A2 check 3: Competitor risk should be acknowledged (not denied)
    # Old draft said "no near-term approval risk" — should now mention ZPH-4
    scores["a2_competitor_acknowledged"] = (
        1.0 if "zph" in lower or "zephyr" in lower else 0.0
    )

    return scores


def run() -> dict[str, float]:
    text = load_output()
    scores: dict[str, float] = {}
    scores.update(check_file_exists(text))
    if text:
        scores.update(check_call_details(text))
        scores.update(check_qa_count(text))
        scores.update(check_risk_topics(text))
        scores.update(check_do_not_say(text))
        scores.update(check_a2_corrections(text))
    else:
        scores.update(
            {
                "call_details_ok": 0.0,
                "qa_count_ok": 0.0,
                "risk_topics_ok": 0.0,
                "do_not_say_ok": 0.0,
                "a2_revenue_updated": 0.0,
                "a2_guidance_updated": 0.0,
                "a2_competitor_acknowledged": 0.0,
            }
        )
    return scores


if __name__ == "__main__":
    import json

    print(json.dumps(run(), indent=2))
