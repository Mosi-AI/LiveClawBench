#!/usr/bin/env python3
"""
Deterministic checks for omni-morning-decision-brief.

Verifies:
1. A message was posted to the #general channel (channel 1) in the chat service.
2. /workspace/daily_action_log.md was updated with today's date entry (B2 check).
3. The chat message references content from at least 2 different services.
"""

import datetime
import json
import urllib.request
from pathlib import Path

DAILY_LOG = Path("/workspace/daily_action_log.md")
CHAT_BASE = "http://localhost:5003"
TODAY = datetime.date.today().isoformat()


def read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def fetch_json(url: str) -> dict | list | None:
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return None


def check_chat_message() -> dict:
    data = fetch_json(f"{CHAT_BASE}/api/channels/1/messages")
    if data is None:
        return {
            "sent": False,
            "message_count": 0,
            "last_message": None,
            "error": "unreachable",
        }

    messages = data.get("messages", [])
    chat_messages = [m for m in messages if m.get("message_kind") == "chat"]
    has_message = len(chat_messages) > 0
    last = chat_messages[-1] if has_message else None
    return {
        "sent": has_message,
        "message_count": len(chat_messages),
        "last_message_preview": (last.get("body", "")[:200] if last else None),
    }


def check_daily_log() -> dict:
    text = read_text(DAILY_LOG)
    exists = DAILY_LOG.is_file()
    has_today = TODAY in text
    today_section_lines = []
    in_today = False
    for line in text.splitlines():
        if TODAY in line and line.startswith("##"):
            in_today = True
        elif in_today and line.startswith("##"):
            in_today = False
        elif in_today:
            today_section_lines.append(line)
    action_item_count = sum(
        1
        for l in today_section_lines
        if l.strip().startswith("- ") and len(l.strip()) > 3
    )
    return {
        "file_exists": exists,
        "has_today_entry": has_today,
        "action_item_count": action_item_count,
    }


def check_message_coverage(chat_result: dict) -> dict:
    preview = (chat_result.get("last_message_preview") or "").lower()
    sources_mentioned = {
        "calendar": any(
            k in preview
            for k in [
                "calendar",
                "meeting",
                "standup",
                "review",
                "10:00",
                "10:30",
                "15:00",
                "09:00",
            ]
        ),
        "email": any(
            k in preview
            for k in [
                "email",
                "inbox",
                "action required",
                "q2",
                "roadmap",
                "cloudedge",
                "pre-read",
            ]
        ),
        "health": any(
            k in preview
            for k in ["health", "steps", "sleep", "heart rate", "hr", "snapshot"]
        ),
        "weather": any(
            k in preview
            for k in ["weather", "beijing", "temperature", "tip", "forecast", "aqi"]
        ),
    }
    source_count = sum(1 for v in sources_mentioned.values() if v)
    return {
        "sources_mentioned": sources_mentioned,
        "multi_source_coverage": source_count >= 2,
        "source_count": source_count,
    }


def run_checks() -> dict:
    chat = check_chat_message()
    log = check_daily_log()
    coverage = check_message_coverage(chat)

    chat_sent_score = 1.0 if chat["sent"] else 0.0
    log_score = (
        1.0
        if (log["has_today_entry"] and log["action_item_count"] >= 1)
        else (0.5 if log["has_today_entry"] else 0.0)
    )

    return {
        "chat_message_sent": chat_sent_score,
        "daily_log_updated": log_score,
        "chat_details": chat,
        "log_details": log,
        "coverage_details": coverage,
    }
