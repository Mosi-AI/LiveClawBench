#!/usr/bin/env python3
"""Deterministic pre-checks for analyst-call-qna-pack."""

import re
from pathlib import Path

ROOT = Path.home() / ".openclaw"
OUT = ROOT / "output"
OUTPUT_PATH = OUT / "analyst_qna.md"


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
    # Count Q&A pairs: lines starting with "### Q:" or "**Q:**" or "Q:"
    patterns = [
        r"^#{1,3}\s+Q[:\.]",
        r"^\*\*Q[:\.]",
        r"^Q\d*[:\.]",
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
        scores.update(check_qa_count(text))
        scores.update(check_risk_topics(text))
        scores.update(check_do_not_say(text))
        scores.update(check_a2_corrections(text))
    else:
        scores.update(
            {
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
