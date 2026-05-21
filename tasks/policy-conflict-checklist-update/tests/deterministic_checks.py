#!/usr/bin/env python3
"""
Deterministic checks for policy-conflict-checklist-update.

Verifies that the three seeded policy conflicts in /workspace/compliance_checklist.md
have been correctly identified and fixed:
  1. PII data retention: 90 days -> 30 days
  2. Password rotation: 180 days -> 90 days
  3. 2FA status: "strongly recommended" -> "mandatory"
"""

import re
from pathlib import Path

CHECKLIST = Path("/workspace/compliance_checklist.md")
CORPUS = Path.home() / ".openclaw" / "corpus"


def read_text(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def checklist_text() -> str:
    return read_text(CHECKLIST).lower()


def check_pii_retention(text: str) -> dict:
    """Conflict 1: PII retention 90 days -> 30 days."""
    old_wrong = re.search(r"\boutdated\b.*90\s*days", text)
    new_correct = re.search(r"\bupdated\b.*30\s*days", text) or re.search(
        r"(?<!9)30\s*days.*pii|pii.*(?<!9)30\s*days", text
    )
    old_uncorrected = bool(
        re.search(r"(?<!\[outdated\] .{0,200})maximum 90 days post-transaction", text)
    )
    score = 0.0
    if new_correct and not old_uncorrected:
        score = 1.0
    elif new_correct or old_wrong:
        score = 0.5
    return {
        "score": score,
        "has_outdated_marker": bool(old_wrong),
        "has_correct_value": bool(new_correct),
        "old_still_unmarked": old_uncorrected,
    }


def check_password_rotation(text: str) -> dict:
    """Conflict 2: Password rotation 180 days -> 90 days."""
    old_wrong = re.search(r"\boutdated\b.*180\s*days", text)
    new_correct = re.search(r"\bupdated\b.*(?<!\d)90\s*days", text) or re.search(
        r"every\s+90\s*days|90[- ]day.*rotat|rotat.*90[- ]day", text
    )
    old_uncorrected = bool(re.search(r"(?<!\[outdated\] .{0,200})every 180 days", text))
    score = 0.0
    if new_correct and not old_uncorrected:
        score = 1.0
    elif new_correct or old_wrong:
        score = 0.5
    return {
        "score": score,
        "has_outdated_marker": bool(old_wrong),
        "has_correct_value": bool(new_correct),
        "old_still_unmarked": old_uncorrected,
    }


def check_2fa_mandatory(text: str) -> dict:
    """Conflict 3: 2FA 'strongly recommended' -> 'mandatory'."""
    old_wrong = re.search(r"\boutdated\b.*(?:strongly\s+recommended|recommended)", text)
    new_correct = re.search(
        r"\bupdated\b.*mandator|\bmandator.*2fa|\b2fa.*mandator", text
    )
    old_uncorrected = bool(
        re.search(
            r"(?<!\[outdated\] .{0,200})strongly recommended for all admin",
            text,
        )
    )
    score = 0.0
    if new_correct and not old_uncorrected:
        score = 1.0
    elif new_correct or old_wrong:
        score = 0.5
    return {
        "score": score,
        "has_outdated_marker": bool(old_wrong),
        "has_correct_value": bool(new_correct),
        "old_still_unmarked": old_uncorrected,
    }


def run_checks() -> dict:
    text = checklist_text()
    checklist_exists = CHECKLIST.is_file()

    c1 = check_pii_retention(text)
    c2 = check_password_rotation(text)
    c3 = check_2fa_mandatory(text)

    conflict_score = round((c1["score"] + c2["score"] + c3["score"]) / 3, 4)

    return {
        "checklist_exists": checklist_exists,
        "conflict_pii_retention": c1,
        "conflict_password_rotation": c2,
        "conflict_2fa_mandatory": c3,
        "conflict_fixes_score": conflict_score,
    }
