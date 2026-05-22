## Task Description

The security team has completed a code audit of your team's web application. The audit report has been sent to your email inbox (http://localhost:5174/).

## Objective

The repository at `/workspace/webapp/` has multiple security issues spanning code vulnerabilities and sensitive data exposure. Conduct a thorough security remediation.

## Deliverables

1. **Clean Git history**: No sensitive credentials or API keys should remain in any commit of the repository
2. **Secure code**: All code-level security vulnerabilities must be identified and fixed
3. **Credential rotation**: All compromised credentials must be replaced with new values, and the application must read secrets from environment variables
4. **Remediation report** at `/workspace/output/remediation_report.md` documenting:
   - What security issues were found (categorized)
   - How each was remediated
   - Recommendations for preventing recurrence


