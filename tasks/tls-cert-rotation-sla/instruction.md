## Task Description

You are an on-call SRE responding to a **critical TLS certificate expiration alert**. The production HTTPS service at `https://localhost` has a certificate that will expire imminently.

## Objective

Rotate the TLS certificate, fix any service configuration issues you discover, and document the procedure — all while minimizing service downtime.

## Deliverables

1. **Working HTTPS**: `https://localhost` must respond successfully with a valid, long-lived certificate
2. **Service logging**: Nginx access logs must be recording requests correctly
3. **Operational runbook** at `/workspace/output/tls_rotation_runbook.md` documenting exact steps taken, verification procedures, and issues found

## SLA Requirement

Total HTTPS downtime during the rotation must not exceed **10 seconds**.


