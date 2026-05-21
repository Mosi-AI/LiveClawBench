# orderstream-api — Dependency Policy

**Owner:** Platform Security, 2026-04 review cycle
**Fingerprint:** ops-dep-v1-2026-04-17-locked

## Version floors (non-negotiable)

| Package | Minimum version | Reason |
|---|---|---|
| `fastapi` | `0.95.0` | `include_router(prefix=...)` semantics |
| `pydantic` | `1.10.13` | CVE-2024-ORDS-001 validation-bypass |
| `cryptography` | `41.0.4` | PSA-2025-CRYPT-07 Fernet reinit |

Versions **below** these floors MUST NOT appear in:
- `requirements.txt`
- `requirements-dev.txt`
- `constraints.txt`
- `Dockerfile` (as a pinned install arg)

## Yanked packages

`cryptography==3.4.8` is yanked upstream. Any explicit pin to that version is
a policy violation even if the wheel happens to be available in the local
mirror.

## Dockerfile rules

1. Install MUST use `pip install -r requirements.txt -c constraints.txt`.
   Bare `pip install -r requirements.txt` bypasses the constraint gate.
2. `--no-deps` is **forbidden** — the audit pipeline requires the resolver
   to see the full dependency graph.
3. Dev dependencies (`requirements-dev.txt`) MUST NOT be installed into the
   production image. Test packages belong only in the CI test stage.

## Python runtime

The pinned Python version across `.tool-versions`, `pyproject.toml::requires-python`,
and the Dockerfile base image MUST be **`>= 3.10`**. 3.9 reached EOL for the
platform SRE team on 2026-01-15.

## Change-management fingerprint

`pyproject.toml` carries `# ops-dep-v1-2026-04-17-locked` as its first line.
The audit pipeline greps for this marker to distinguish in-place edits from
regenerated files. Removing or altering this line is a P2 ticket.
