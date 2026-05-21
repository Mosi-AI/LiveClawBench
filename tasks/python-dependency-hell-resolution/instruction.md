# Python Dependency Hell — CI Pipeline Resolution

The CI pipeline for `orderstream-api` has been **red for 14 hours**. On-call has paged twice.

## Background

`/workspace/app/` is a FastAPI service. After a recent dependency refresh, the CI is reporting multiple errors simultaneously:
install failures, import failures, pytest failures, and security scan warnings. The previous engineer's triage
notes are at `/workspace/app/runbook.md`, but some of the suggestions are unreliable.

Your task is to get the CI back to green and produce a structured root cause report.

## Deliverables

1. The dependency declaration files under `/workspace/app/` must be self-consistent and successfully
   installable using the offline wheel cache (`/opt/wheels/`).
2. The application must correctly import all modules and all pytest tests must pass.
3. Security policy compliance (see `/workspace/app/POLICY.md`).
4. `/workspace/app/Dockerfile` must conform to team standards (see POLICY.md).
5. `/workspace/output/dependency_resolution_report.md` must contain a fenced
   `json` code block in the following format:

   ````markdown
   ```json
   {
     "root_causes": [
       {"id": 1, "symptom": "...", "files": ["..."], "fix": "..."},
       {"id": 2, "symptom": "...", "files": ["..."], "fix": "..."}
     ],
     "remaining_risks": ["..."]
   }
   ```
   ````

## Key Constraints

- **No internet access**. All packages must be resolved from `/opt/wheels/`. The verifier will
  test offline installation using `pip install --no-index --find-links=/opt/wheels`.
- **`--no-deps` is not allowed** (POLICY.md).
- The `# ops-dep-v1-2026-04-17-locked` comment at the top of `pyproject.toml` is a
  compliance marker and **must be preserved**. Directly rewriting the file will lose the marker.
- Verify `runbook.md` claims yourself before acting on them — it was written by the previous on-call engineer and not all suggestions are reliable.

## Local Self-Test

```bash
# Offline install
python3 -m venv /tmp/venv
/tmp/venv/bin/pip install --no-index --find-links=/opt/wheels \
    -r /workspace/app/requirements.txt -c /workspace/app/constraints.txt

# Run tests
cd /workspace/app && /tmp/venv/bin/python -m pytest tests/ -v
```

The verifier will repeat these two steps, and additionally checks POLICY.md compliance, version consistency, ops-fingerprint preservation, report structure, and other dimensions (9 total).
