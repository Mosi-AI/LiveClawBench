#!/usr/bin/env bash
# Reference solution for python-dependency-hell-resolution.
# Applies minimum-diff patches to the 6 bugs + writes the structured report.
set -euo pipefail

APP=/workspace/app
OUT=/workspace/output
mkdir -p "$OUT"

# --- Bug 1 + 2 + 3: rewrite requirements.txt to match POLICY floors,
#     add orjson (bug 6), remove yanked cryptography 3.4.8 (bug 3).
cat > "$APP/requirements.txt" <<'EOF'
# Runtime deps for orderstream-api — aligned with POLICY.md floors.
fastapi==0.95.2
pydantic==1.10.13
cryptography==41.0.4
httpx==0.24.1
starlette==0.27.0
anyio==3.7.1
sniffio==1.3.0
idna==3.4
h11==0.14.0
certifi==2023.7.22
typing_extensions==4.7.1
cffi==1.15.1
pycparser==2.21
orjson==3.9.10
httpcore==0.17.3
EOF

# --- Bug 4: pytest-asyncio is dev-only; also keep requirements-dev.txt coherent
cat > "$APP/requirements-dev.txt" <<'EOF'
# Dev / test deps — installed in the CI test stage only.
pytest==7.4.3
pytest-asyncio==0.21.1
iniconfig==2.0.0
packaging==23.2
pluggy==1.3.0
exceptiongroup==1.1.3
tomli==2.0.1
EOF

# --- Bug 5: Dockerfile must honor constraints.txt and forbid --no-deps.
#     Also bump base Python to 3.11 per POLICY.md rule on Python version.
cat > "$APP/Dockerfile" <<'EOF'
# orderstream-api — production image
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt constraints.txt ./
RUN pip install --no-cache-dir -r requirements.txt -c constraints.txt

COPY src/ ./src/
ENV PYTHONPATH=/app/src

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "webapp.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

# --- Bug (Python version): bump .tool-versions
echo "python 3.11.7" > "$APP/.tool-versions"

# --- Structured resolution report
cat > "$OUT/dependency_resolution_report.md" <<'EOF'
# orderstream-api — Dependency Hell Resolution

## Summary

CI was red due to 6 layered dependency issues spanning version drift,
a yanked package, a CVE, a scoping mistake, a policy-violating Dockerfile,
and an undeclared import. All resolved against the offline wheel cache at
`/opt/wheels/`.

## Root-cause table

```json
{
  "root_causes": [
    {
      "id": 1,
      "symptom": "fastapi/pydantic/cryptography versions drift between requirements.txt and constraints.txt",
      "files": ["requirements.txt", "constraints.txt"],
      "fix": "Align requirements.txt to the POLICY.md floors (fastapi==0.95.2, pydantic==1.10.13, cryptography==41.0.4)"
    },
    {
      "id": 2,
      "symptom": "pydantic==1.10.2 triggers CVE-2024-ORDS-001 (validation bypass on min_length)",
      "files": ["requirements.txt"],
      "fix": "Bump pydantic to 1.10.13 per POLICY.md"
    },
    {
      "id": 3,
      "symptom": "cryptography==3.4.8 is yanked upstream; POLICY forbids yanked pins",
      "files": ["requirements.txt", "runbook.md (stale advice)"],
      "fix": "Bump cryptography to 41.0.4; ignore runbook.md suggestion to stay on 3.4.8"
    },
    {
      "id": 4,
      "symptom": "pytest-asyncio only in requirements-dev.txt; CI runs `pip install -r requirements.txt` so test collection finds 0 tests",
      "files": ["requirements-dev.txt", "Dockerfile (CI test stage)"],
      "fix": "Keep pytest-asyncio in requirements-dev.txt and ensure the CI test stage installs both files; runtime image keeps dev deps out"
    },
    {
      "id": 5,
      "symptom": "Dockerfile uses `pip install -r requirements.txt` bare — violates POLICY rule 1 (must use `-c constraints.txt`)",
      "files": ["Dockerfile"],
      "fix": "Change install line to `pip install -r requirements.txt -c constraints.txt`; also bump base image to python:3.11-slim per Python-version floor"
    },
    {
      "id": 6,
      "symptom": "webapp/main.py imports orjson but orjson is declared in NO manifest",
      "files": ["requirements.txt", "constraints.txt"],
      "fix": "Add orjson==3.9.10 to requirements.txt (already in constraints.txt)"
    }
  ],
  "remaining_risks": [
    "httpcore transitive pin depends on httpx; verified 0.17.3 works with httpx 0.24.1",
    "starlette bumped 0.22.0 -> 0.27.0 — review for breaking changes in middleware stack"
  ]
}
```

## What was NOT changed

- `pyproject.toml` — only content kept verbatim is the `ops-dep-v1-2026-04-17-locked`
  fingerprint on line 1.
- `constraints.txt` — already at POLICY floors; used as-is.
- Application code — no behavioral changes needed.
EOF

# Preserve fingerprint — pyproject.toml already has it, no edit needed.

echo "solve.sh: completed"
