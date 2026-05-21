## Task Description

Your team's gRPC-based microservice has been experiencing intermittent failures in production. Users report that the service occasionally becomes unresponsive or returns errors.

## Objective

A bug report has been sent to your email inbox at http://localhost:5174/. The service source code is at `/workspace/kv-store/`.

Diagnose the root cause(s) of the instability, apply fixes, and ensure the service runs reliably under load. You must also write a diagnosis report explaining your findings.

## Deliverables

1. A stable gRPC KV-Store service running on its designated port
2. The service must handle concurrent operations without crashing or losing data
3. A diagnosis report at `/workspace/output/diagnosis.md` documenting:
   - What bug(s) you found and their root cause
   - How each bug manifests under load
   - What fixes you applied and why they work
   - How you verified the service is now stable


