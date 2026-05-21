# Q2 2026 Compliance Review — TerraScale Logistics Integration
**Prepared by:** Legal & Compliance Team
**Review Date:** April 2026
**Status:** OPEN — Action Required

## Scope

This review covers TerraScale Logistics' compliance posture as it relates to a potential data sharing and API integration arrangement. The review was triggered by TerraScale's EU market operations and our obligations under applicable data protection regulations.

## GDPR Data Transfer Assessment

**Finding: CRITICAL GAP**

TerraScale's current Data Processing Agreement (DPA) does not include Standard Contractual Clauses (SCCs) under Article 46 GDPR for data transfers between their EU-based data centers and their APAC operations hub (Singapore).

**Implications:**
- Any data we share with TerraScale that includes EU-origin personal data (e.g., end-customer shipping addresses, contact details) would be subject to this exposure
- Under GDPR Article 46, cross-border data transfers outside the EEA require either SCCs, Binding Corporate Rules, or an adequacy decision — Singapore does not have an adequacy decision from the EU
- If we proceed to production without this resolved, both parties face potential regulatory exposure under GDPR Article 83

**TerraScale's Response (April 10, 2026):**
TerraScale's legal team acknowledged the gap and confirmed they are "aware of the issue" and are "working with external counsel to update the DPA." No timeline has been provided. The gap remains OPEN as of this review.

## Recommendations

1. Do not proceed to a production data sharing arrangement until TerraScale has executed updated SCCs or provided equivalent GDPR-compliant transfer mechanism
2. Require a written commitment with a specific remediation deadline at the upcoming partnership meeting
3. Consider a restricted pilot scope (non-EU data only) as an interim workaround if timeline is unacceptable

---
*This document is for internal compliance planning purposes only.*
