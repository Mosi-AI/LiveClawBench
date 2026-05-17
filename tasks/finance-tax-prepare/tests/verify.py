#!/usr/bin/env python3
"""
Verifier for finance-tax-prepare task.

Checks 5 dimensions:
  - invoice_created (0.15): INV-2026-010 exists with 2 line items
  - vat_per_invoice (0.25): Policy contains correct VAT for all 3 invoices
  - vat_total (0.15): Policy contains correct total Q1 2026 VAT ($2,130.03)
  - policy_updated (0.20): Policy has been updated with filing section
  - email_sent (0.25): Reply sent to tax authority with VAT summary

Expected VAT calculations:
  INV-2026-001: 12500.50*0.06 + 3000.00*0.06 = 750.03 + 180.00 = 930.03
  INV-2026-002: 52000.00*0.00 = 0.00 (travel exempt)
  INV-2026-010: 15000.00*0.06 + 5000.00*0.06 = 900.00 + 300.00 = 1200.00
  Total: 930.03 + 0.00 + 1200.00 = 2130.03
"""

import json
import os
import re
import sqlite3
import sys
import traceback

FINANCE_DB_PATH = os.environ.get(
    "MOCK_FINANCE_DB_PATH", "/opt/mock/data/finance_app.sqlite"
)
EMAIL_DB_PATH = os.environ.get("EMAIL_DB_PATH", "/var/lib/mock-data/email/email.db")
POLICY_PATH = "/workspace/policies/tax_policy.md"

WEIGHTS = {
    "invoice_created": 0.15,
    "vat_per_invoice": 0.25,
    "vat_total": 0.15,
    "policy_updated": 0.20,
    "email_sent": 0.25,
}

# Expected values
EXPECTED_INVOICE_010 = {
    "vendor_id": 1,
    "invoice_number": "INV-2026-010",
    "invoice_date": "2026-03-01",
    "items": [
        ("Software License Renewal", "5300", 15000.00),
        ("Technical Support Package", "5400", 5000.00),
    ],
}

EXPECTED_VAT = {
    "INV-2026-001": 930.03,
    "INV-2026-002": 0.00,
    "INV-2026-010": 1200.00,
}
EXPECTED_TOTAL = 2130.03

# 1% tolerance for VAT amount matching
VAT_TOLERANCE_FRAC = 0.01


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


def check_invoice_created(conn: sqlite3.Connection, details: dict) -> float:
    """Check INV-2026-010 exists with correct vendor, date, and 2 line items."""
    inv_row = conn.execute(
        "SELECT id, vendor_id, invoice_date FROM invoice WHERE invoice_number = ?",
        ("INV-2026-010",),
    ).fetchone()

    if not inv_row:
        return record_score(
            details,
            "invoice_created",
            False,
            "",
            "Invoice INV-2026-010 not found in finance DB",
        )

    vendor_ok = inv_row["vendor_id"] == EXPECTED_INVOICE_010["vendor_id"]
    date_ok = inv_row["invoice_date"] == EXPECTED_INVOICE_010["invoice_date"]

    if not vendor_ok or not date_ok:
        return record_score(
            details,
            "invoice_created",
            False,
            "",
            f"INV-2026-010 found but vendor_id={inv_row['vendor_id']} (expected 1), "
            f"date={inv_row['invoice_date']} (expected 2026-03-01)",
        )

    # Check line items
    items = conn.execute(
        "SELECT description, category_code, amount FROM invoice_line_item WHERE invoice_id = ?",
        (inv_row["id"],),
    ).fetchall()

    if len(items) != 2:
        return record_score(
            details,
            "invoice_created",
            False,
            "",
            f"INV-2026-010 has {len(items)} line items (expected 2)",
        )

    # Match expected items by category_code and amount (tolerance 0.01)
    used = set()
    for exp_desc, exp_code, exp_amount in EXPECTED_INVOICE_010["items"]:
        matched = False
        for i, item in enumerate(items):
            if i in used:
                continue
            if (
                item["category_code"] == exp_code
                and abs(item["amount"] - exp_amount) < 0.01
            ):
                used.add(i)
                matched = True
                break
        if not matched:
            actual = [(r["category_code"], r["amount"]) for r in items]
            return record_score(
                details,
                "invoice_created",
                False,
                "",
                f"INV-2026-010 line items mismatch. Expected 5300/15000 + 5400/5000, got {actual}",
            )

    items_str = ", ".join(f"{r['category_code']}:${r['amount']:.2f}" for r in items)
    return record_score(
        details,
        "invoice_created",
        True,
        f"INV-2026-010 created with vendor_id=1, date=2026-03-01, items: {items_str}",
        "",
    )


def extract_amounts_near_keyword(
    text: str, keyword: str, radius: int = 300
) -> list[float]:
    """Extract dollar amounts near a keyword in text."""
    amounts = []
    # Find all occurrences of the keyword
    for match in re.finditer(re.escape(keyword), text, re.IGNORECASE):
        start = max(0, match.start() - radius)
        end = min(len(text), match.end() + radius)
        context = text[start:end]
        # Find dollar amounts like $930.03, $1,200.00, 2130.03, $2,130.03
        for num_match in re.finditer(r"\$?\s*([\d,]+\.\d{2})", context):
            amount_str = num_match.group(1).replace(",", "")
            try:
                amounts.append(float(amount_str))
            except ValueError:
                pass
    return amounts


def check_vat_in_policy(policy_text: str, details: dict) -> float:
    """Check VAT amounts for each invoice in the policy file."""
    invoices_correct = 0
    invoice_results = []

    for inv_num, expected_vat in EXPECTED_VAT.items():
        # Search for the invoice number in the policy
        amounts_near = extract_amounts_near_keyword(policy_text, inv_num)

        if not amounts_near:
            invoice_results.append(
                f"{inv_num}: no amounts found near invoice reference"
            )
            continue

        tolerance = expected_vat * VAT_TOLERANCE_FRAC if expected_vat > 0 else 0.01
        found = any(abs(a - expected_vat) <= tolerance for a in amounts_near)

        if found:
            invoices_correct += 1
            invoice_results.append(f"{inv_num}: VAT ${expected_vat:.2f} found")
        else:
            invoice_results.append(
                f"{inv_num}: expected VAT ${expected_vat:.2f}, "
                f"found amounts nearby: {amounts_near[:5]}"
            )

    passed = invoices_correct == len(EXPECTED_VAT)
    return record_score(
        details,
        "vat_per_invoice",
        passed,
        f"VAT per invoice correct: {'; '.join(invoice_results)}",
        f"VAT per invoice incorrect ({invoices_correct}/{len(EXPECTED_VAT)}): {'; '.join(invoice_results)}",
    )


def check_vat_total(policy_text: str, details: dict) -> float:
    """Check total Q1 2026 VAT amount in policy."""
    # Look for total amounts near "total" keywords
    total_keywords = ["total", "Total", "TOTAL", "Q1 2026", "quarterly"]
    all_amounts = []

    for kw in total_keywords:
        amounts = extract_amounts_near_keyword(policy_text, kw, radius=200)
        all_amounts.extend(amounts)

    tolerance = EXPECTED_TOTAL * VAT_TOLERANCE_FRAC
    found = any(abs(a - EXPECTED_TOTAL) <= tolerance for a in all_amounts)

    return record_score(
        details,
        "vat_total",
        found,
        f"Total Q1 2026 VAT ${EXPECTED_TOTAL:.2f} found in policy",
        f"Total Q1 2026 VAT ${EXPECTED_TOTAL:.2f} not found in policy "
        f"(amounts near total keywords: {all_amounts[:10]})",
    )


def check_policy_updated(policy_text: str, details: dict) -> float:
    """Check that the PENDING section has been updated with filing data."""
    lower = policy_text.lower()

    # The policy should no longer say PENDING (or should have filing data after it)
    still_pending = "filing status: pending" in lower or "status: pending" in lower

    # Check for filing-related keywords
    filing_keywords = ["filed", "calculated", "completed", "submitted"]
    found_keywords = [kw for kw in filing_keywords if kw in lower]

    # Check for Q1 2026 references in the updated section
    has_q1_ref = "q1 2026" in lower
    has_total = "total" in lower

    if still_pending and not found_keywords:
        return record_score(
            details,
            "policy_updated",
            False,
            "",
            "Tax policy still shows PENDING status, no filing keywords found",
        )

    score_ok = len(found_keywords) >= 1 and has_q1_ref and has_total
    return record_score(
        details,
        "policy_updated",
        score_ok,
        f"Policy updated with filing data (keywords: {found_keywords}, Q1 ref: {has_q1_ref})",
        f"Policy update incomplete: keywords={found_keywords}, Q1_ref={has_q1_ref}, total={has_total}",
    )


def check_email_sent(email_conn: sqlite3.Connection, details: dict) -> float:
    """Check that a reply was sent to the tax authority with VAT summary."""
    # Look for sent emails to tax-authority.gov
    sent_emails = email_conn.execute(
        "SELECT recipient_email, subject, body FROM emails "
        "WHERE folder = 'sent' AND recipient_email LIKE '%tax-authority.gov%'"
    ).fetchall()

    if not sent_emails:
        # Also try a broader search
        sent_emails = email_conn.execute(
            "SELECT recipient_email, subject, body FROM emails WHERE folder = 'sent'"
        ).fetchall()
        tax_emails = [
            e for e in sent_emails if "tax-authority" in e["recipient_email"].lower()
        ]
        if not tax_emails:
            return record_score(
                details,
                "email_sent",
                False,
                "",
                f"No email sent to tax-authority.gov (found {len(sent_emails)} sent emails total)",
            )
        sent_emails = tax_emails

    # Check that the email contains VAT summary info
    best_match = False
    best_details = ""

    for email in sent_emails:
        combined = (email["subject"] + " " + email["body"]).lower()

        # Check for VAT-related content
        has_vat = "vat" in combined
        has_amount = any(
            kw in combined for kw in ["930", "1200", "2130", "2,130", "1,200"]
        )
        has_inv_ref = any(
            kw in combined
            for kw in ["inv-2026-001", "inv-2026-002", "inv-2026-010", "inv_2026"]
        )

        if has_vat and has_amount:
            best_match = True
            best_details = (
                f"to={email['recipient_email']}, subject={email['subject'][:60]}"
            )
            break

        # Partial match tracking
        if not best_details:
            best_details = (
                f"to={email['recipient_email']}, has_vat={has_vat}, "
                f"has_amount={has_amount}, has_inv={has_inv_ref}"
            )

    return record_score(
        details,
        "email_sent",
        best_match,
        f"Reply email with VAT summary sent ({best_details})",
        f"Email to tax authority missing VAT summary ({best_details})",
    )


def main() -> tuple[float, dict]:
    score = 0.0
    details: dict[str, list | dict] = {"messages": [], "dimension_scores": {}}

    # 1. Check invoice created
    try:
        if os.path.exists(FINANCE_DB_PATH):
            fin_conn = sqlite3.connect(FINANCE_DB_PATH)
            fin_conn.row_factory = sqlite3.Row
            score += check_invoice_created(fin_conn, details)
            fin_conn.close()
        else:
            details["messages"].append(
                f"ERROR: Finance DB not found at {FINANCE_DB_PATH}"
            )
    except Exception as e:
        details["messages"].append(f"ERROR checking invoice: {e}")
        details["messages"].append(traceback.format_exc())

    # 2-4. Check policy file (VAT amounts, total, update status)
    try:
        if os.path.exists(POLICY_PATH):
            with open(POLICY_PATH, "r") as f:
                policy_text = f.read()
            score += check_vat_in_policy(policy_text, details)
            score += check_vat_total(policy_text, details)
            score += check_policy_updated(policy_text, details)
        else:
            details["messages"].append(f"ERROR: Policy file not found at {POLICY_PATH}")
            # Award 0 for all policy-related dimensions
            for dim in ["vat_per_invoice", "vat_total", "policy_updated"]:
                details["dimension_scores"][dim] = 0.0
    except Exception as e:
        details["messages"].append(f"ERROR checking policy: {e}")
        details["messages"].append(traceback.format_exc())

    # 5. Check email sent
    try:
        if os.path.exists(EMAIL_DB_PATH):
            email_conn = sqlite3.connect(EMAIL_DB_PATH)
            email_conn.row_factory = sqlite3.Row
            score += check_email_sent(email_conn, details)
            email_conn.close()
        else:
            details["messages"].append(f"ERROR: Email DB not found at {EMAIL_DB_PATH}")
            details["dimension_scores"]["email_sent"] = 0.0
    except Exception as e:
        details["messages"].append(f"ERROR checking email: {e}")
        details["messages"].append(traceback.format_exc())

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
