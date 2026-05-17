#!/usr/bin/env python3
"""
Verifier for finance-analysis-generate task.

Checks 5 dimensions:
  - report_exists (0.1): Report file exists and is non-empty (>= 200 chars)
  - report_sections (0.25): Report contains at least 3 of 5 required sections
  - report_data (0.25): Report contains department names, month refs, dollar amounts
  - email_sent (0.2): Email sent to cfo@acmecorp.com
  - template_updated (0.2): Report template has been modified from original

Aggregate score = sum of earned weights.
"""

import hashlib
import json
import os
import re
import sqlite3
import sys

FINANCE_DB_PATH = os.environ.get(
    "MOCK_FINANCE_DB_PATH", "/opt/mock/data/finance_app.sqlite"
)
EMAIL_DB_PATH = "/var/lib/mock-data/email/email.db"
REPORT_PATH = "/workspace/output/report.md"
TEMPLATE_PATH = "/workspace/policies/report_template.md"

# Original template content hash (SHA-256 of the file content without trailing newline)
_ORIGINAL_TEMPLATE_TEXT = """# Acme Corp Financial Analysis Report Template

> **Purpose**: This document defines the standard format and required sections for all Acme Corp financial analysis reports. All analysts must follow this template when producing reports.

---

## Report Title Format

**Acme Corp Financial Analysis Report - {Period}**

Replace `{Period}` with the reporting period (e.g., "Q1 2026", "March 2026").

---

## Required Sections

Reports must contain the following sections in order:

### 1. Executive Summary

A brief overview of financial performance for the reporting period. This should be 1-2 paragraphs summarizing the key takeaways: overall budget adherence, revenue performance, and any notable concerns.

### 2. Department Performance Analysis

For each department, provide a breakdown showing budget vs. actual expenses vs. revenue for each month in the reporting period. Must include the department name and specific dollar amounts. Present the data in a table format for clarity.

### 3. Budget Variance Analysis

Identify departments that are over budget and quantify the variance (both absolute dollar amount and percentage). Highlight any departments trending toward budget overruns even if they remain within limits for the current period.

### 4. Key Findings

Highlight notable trends, patterns, or anomalies observed in the data. This may include:
- Departments with significant month-over-month changes
- Revenue growth or decline patterns
- Unusual expense spikes
- Correlations between department spending and revenue

### 5. Recommendations

Actionable suggestions based on the analysis. Each recommendation should reference specific data points from the report and propose concrete next steps.

---

## Format Guidelines

- Use **Markdown format** for all reports
- Include **tables** for numerical data comparisons
- All monetary values in **USD with 2 decimal places** (e.g., $50,000.00)
- Use clear section headers with proper markdown heading levels

---

## Additional Sections

### Market Analysis (Optional)

Analysis of broader market conditions and their impact on company performance. Include industry benchmarks where available.

> **Note**: Market Analysis is mandatory for Q1 reports, as quarterly market context is essential for board presentations.

### Year-over-Year Comparison (Required)

Comparison of current period financials against the same period in the prior year. Required for all reports to establish baseline trends.

### Regulatory Compliance Notes (Mandatory for Annual Reports Only)

Notes on regulatory filings, compliance deadlines, and audit-related observations. Only required for annual reports.

---

## Template Version

v1.0 - Last updated: 2025-12-15
"""

ORIGINAL_TEMPLATE_SIZE = len(_ORIGINAL_TEMPLATE_TEXT)
ORIGINAL_TEMPLATE_HASH = hashlib.sha256(_ORIGINAL_TEMPLATE_TEXT.encode()).hexdigest()

WEIGHTS = {
    "report_exists": 0.1,
    "report_sections": 0.25,
    "report_data": 0.25,
    "email_sent": 0.2,
    "template_updated": 0.2,
}

REQUIRED_SECTIONS = [
    "executive summary",
    "department performance",
    "budget variance",
    "key findings",
    "recommendations",
]

DEPARTMENT_NAMES = [
    "engineering",
    "sales",
    "marketing",
    "hr",
    "finance",
    "operations",
]

# Distinctive March 2026 figures from the seeded finance data. These values
# only appear after the agent calls GET /api/departments?month=2026-03. The
# default Jan/Feb seed uses uniform 150000/85000/180000 across all departments,
# so the per-department March numbers are the strongest evidence that the
# report contains real data rather than fabricated placeholders.
SEED_MARCH_VALUES = frozenset(
    {
        # Engineering: 50000 budget, 55000 actual, 62000 revenue
        50000,
        55000,
        62000,
        # Sales: 40000 budget, 38000 actual, 78000 revenue
        40000,
        38000,
        78000,
        # Marketing: 30000 budget, 32000 actual, 41000 revenue
        30000,
        32000,
        41000,
        # HR: 20000 budget, 19500 actual, 5000 revenue
        20000,
        19500,
        5000,
        # Finance: 25000 budget, 23000 actual, 8000 revenue
        25000,
        23000,
        8000,
        # Operations: 35000 budget, 34000 actual, 12000 revenue
        35000,
        34000,
        12000,
    }
)

# Require at least 5 distinctive March values. Engineering alone provides 3
# (50000/55000/62000), so 5 forces the agent to look beyond a single department.
MIN_SEED_VALUE_MATCHES = 5

NUMERIC_TOKEN_RE = re.compile(r"\$?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?")


def record_score(
    details: dict,
    dimension: str,
    passed: bool,
    pass_msg: str,
    fail_msg: str,
) -> float:
    """Record a dimension score and message, returning the earned weight."""
    if passed:
        details["dimension_scores"][dimension] = WEIGHTS[dimension]
        details["messages"].append(f"PASS: {pass_msg}")
        return WEIGHTS[dimension]
    details["dimension_scores"][dimension] = 0.0
    details["messages"].append(f"FAIL: {fail_msg}")
    return 0.0


def check_report_exists(report_text: str) -> bool:
    """Check report exists and has substantial content."""
    return len(report_text) >= 200


def check_report_sections(report_text: str) -> int:
    """Return count of required sections found (case-insensitive)."""
    lower = report_text.lower()
    found = 0
    for section in REQUIRED_SECTIONS:
        if section in lower:
            found += 1
    return found


def _extract_numeric_values(text: str) -> set[int]:
    """Extract integer financial figures from the report.

    Accepts both comma-separated ($55,000.00) and bare (55000) forms. Fractional
    cents are dropped — match is against the integer dollar amount because the
    seed values are whole dollars.
    """
    values: set[int] = set()
    for match in NUMERIC_TOKEN_RE.finditer(text):
        digits = match.group(1).replace(",", "")
        try:
            val = int(digits)
        except ValueError:
            continue
        # Filter out tiny values (likely section numbers, percentages, or years)
        # to keep the match anchored on dollar figures.
        if val >= 1000:
            values.add(val)
    return values


def check_report_data(report_text: str) -> tuple[bool, bool, bool, int]:
    """Check for department names, month refs, and distinctive seed data.

    Returns (depts_ok, months_ok, data_ok, seed_match_count). The data check
    requires at least ``MIN_SEED_VALUE_MATCHES`` distinct figures from the
    March 2026 seed; this prevents passing a report that fabricates numbers.
    """
    lower = report_text.lower()

    # Department names: at least 3
    depts_found = sum(1 for dept in DEPARTMENT_NAMES if dept in lower)

    # Month references
    month_patterns = [
        "2026-01",
        "2026-02",
        "2026-03",
        "january",
        "february",
        "march",
        "jan",
        "feb",
        "mar",
    ]
    months_found = any(p in lower for p in month_patterns)

    # Distinctive seed-data values: require enough overlap to prove the agent
    # actually queried the finance API rather than inventing numbers.
    seed_matches = _extract_numeric_values(report_text) & SEED_MARCH_VALUES
    data_ok = len(seed_matches) >= MIN_SEED_VALUE_MATCHES

    return depts_found >= 3, months_found, data_ok, len(seed_matches)


def check_email_sent(email_conn: sqlite3.Connection) -> bool:
    """Check if an email was sent to cfo@acmecorp.com."""
    rows = email_conn.execute(
        "SELECT recipient_email FROM emails WHERE folder = 'sent'"
    ).fetchall()
    for row in rows:
        if "cfo@acmecorp.com" in row[0].lower():
            return True
    return False


def check_template_updated(template_text: str) -> bool:
    """Check if the template has been modified from original."""
    # Check hash
    current_hash = hashlib.sha256(template_text.encode()).hexdigest()
    if current_hash != ORIGINAL_TEMPLATE_HASH:
        return True

    # Check size difference (at least 50 chars added)
    if len(template_text) >= ORIGINAL_TEMPLATE_SIZE + 50:
        return True

    # Check for update keywords
    lower = template_text.lower()
    update_keywords = ["updated", "revision", "note", "q1 2026", "v1.1", "v2.0"]
    if any(kw in lower for kw in update_keywords):
        # Only count if version/date line has changed
        if "v1.0" not in template_text or "2025-12-15" not in template_text:
            return True

    return False


def main() -> tuple[float, dict]:
    score = 0.0
    details: dict[str, list | dict] = {"messages": [], "dimension_scores": {}}

    # 1. Report exists
    report_text = ""
    try:
        with open(REPORT_PATH, "r") as f:
            report_text = f.read()
    except FileNotFoundError:
        pass

    score += record_score(
        details,
        "report_exists",
        check_report_exists(report_text),
        f"Report exists with {len(report_text)} characters",
        f"Report missing or too short ({len(report_text)} chars, need >= 200)",
    )

    # 2. Report sections (at least 3 of 5)
    if report_text:
        sections_found = check_report_sections(report_text)
        score += record_score(
            details,
            "report_sections",
            sections_found >= 3,
            f"Found {sections_found}/5 required sections",
            f"Only found {sections_found}/5 required sections (need >= 3)",
        )
    else:
        details["dimension_scores"]["report_sections"] = 0.0
        details["messages"].append("FAIL: No report to check sections")

    # 3. Report data quality
    if report_text:
        depts_ok, months_ok, dollars_ok, seed_matches = check_report_data(report_text)
        data_ok = depts_ok and months_ok and dollars_ok
        data_parts = []
        if depts_ok:
            data_parts.append("3+ department names")
        if months_ok:
            data_parts.append("month references")
        if dollars_ok:
            data_parts.append(
                f"{seed_matches} distinctive seed values (>= {MIN_SEED_VALUE_MATCHES})"
            )

        # Proportional credit for partial data
        data_score = sum([depts_ok, months_ok, dollars_ok]) / 3.0
        earned = round(WEIGHTS["report_data"] * data_score, 4)
        details["dimension_scores"]["report_data"] = earned
        score += earned
        if data_ok:
            details["messages"].append(
                f"PASS: Report contains real data: {', '.join(data_parts)}"
            )
        else:
            missing = []
            if not depts_ok:
                missing.append("department names (< 3 found)")
            if not months_ok:
                missing.append("month references")
            if not dollars_ok:
                missing.append(
                    f"distinctive seed values "
                    f"(found {seed_matches}/{MIN_SEED_VALUE_MATCHES} required; "
                    f"report must use figures retrieved from the finance API)"
                )
            details["messages"].append(
                f"PARTIAL: Report data quality: {', '.join(data_parts)}; "
                f"missing: {', '.join(missing)}"
            )
    else:
        details["dimension_scores"]["report_data"] = 0.0
        details["messages"].append("FAIL: No report to check data")

    # 4. Email sent
    email_ok = False
    try:
        email_conn = sqlite3.connect(EMAIL_DB_PATH)
        email_ok = check_email_sent(email_conn)
        email_conn.close()
    except Exception:
        pass

    score += record_score(
        details,
        "email_sent",
        email_ok,
        "Email sent to cfo@acmecorp.com",
        "No email found sent to cfo@acmecorp.com",
    )

    # 5. Template updated
    template_text = ""
    try:
        with open(TEMPLATE_PATH, "r") as f:
            template_text = f.read()
    except FileNotFoundError:
        pass

    template_ok = check_template_updated(template_text) if template_text else False
    score += record_score(
        details,
        "template_updated",
        template_ok,
        "Report template has been updated",
        "Report template appears unchanged from original",
    )

    return score, details


if __name__ == "__main__":
    score, details = main()

    print(f"Score: {score:.2f}/1.0")
    for msg in details["messages"]:
        print(f"  {msg}")

    # Write reward.json breakdown
    try:
        reward_json = {"reward": round(score, 2)}
        reward_json.update(details["dimension_scores"])
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(reward_json, f, indent=2)
    except Exception:
        pass

    sys.exit(0 if score >= 0.5 else 1)
