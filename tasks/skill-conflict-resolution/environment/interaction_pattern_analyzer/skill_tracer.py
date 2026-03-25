"""
SH2 Skill Tracer — Invocation tracking and tamper-proof verification module

Features:
  1. Records each Skill invocation (timestamp, parameter digest, call stack)
  2. Computes SHA-256 of the Skill source file, embeds it in output to prevent bypass
  3. Generates a unique nonce, written to both audit log and output JSON

As long as the agent preserves the skill_tracer import and the
wrap_skill_output / log_invocation calls, tracking is maintained.
The evaluation script verifies Skill execution via audit log + _trace field in output.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
import traceback
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

# ---------------------------------------------------------------------------
# Audit log path: fixed to sh2_bench/output/skill_audit.jsonl
# ---------------------------------------------------------------------------
_BENCH_DIR = os.environ.get(
    "SH2_BENCH_DIR",
    str(Path(__file__).resolve().parents[1]),   # default: skill_dir/../ = bench root
)
AUDIT_LOG_PATH = Path(_BENCH_DIR) / "output" / "skill_audit.jsonl"


def _ensure_audit_dir() -> None:
    AUDIT_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)


def _hash_file(path: Path) -> str:
    """Return SHA-256 hex digest of file; returns 'MISSING' if file not found."""
    try:
        return hashlib.sha256(path.read_bytes()).hexdigest()
    except Exception:
        return "MISSING"


def _caller_info(depth: int = 3) -> Dict[str, Any]:
    """Capture call stack info to confirm Skill actually ran."""
    stack = traceback.extract_stack()
    if len(stack) >= depth:
        frame = stack[-depth]
        return {
            "caller_file": frame.filename,
            "caller_line": frame.lineno,
            "caller_func": frame.name,
        }
    return {}


def log_invocation(
    skill_file: str,
    version: str,
    payload: Dict[str, Any],
    extra: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Call at Skill.run() entry. Records invocation to audit log, returns nonce.

    Args:
      skill_file: __file__ of the calling skill module
      version:    skill version string
      payload:    request payload (only keys are logged)
      extra:      optional additional info

    Returns:
      nonce (UUID4) — pass to wrap_skill_output to embed in output
    """
    _ensure_audit_dir()

    nonce = str(uuid.uuid4())
    skill_path = Path(skill_file).resolve()

    entry = {
        "event": "invocation",
        "nonce": nonce,
        "timestamp": time.time(),
        "iso_time": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "skill_file": str(skill_path),
        "skill_hash": _hash_file(skill_path),
        "skill_version": version,
        "pid": os.getpid(),
        "payload_keys": list(payload.keys()) if isinstance(payload, dict) else str(type(payload)),
        "target_files": payload.get("target_files", []) if isinstance(payload, dict) else [],
        "caller": _caller_info(),
    }
    if extra:
        entry["extra"] = extra

    with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

    return nonce


def wrap_skill_output(
    result: Dict[str, Any],
    nonce: str,
    skill_file: str,
    version: str,
) -> Dict[str, Any]:
    """
    Call before Skill.run() returns. Embeds _trace metadata into result JSON.

    The evaluation script checks:
      1. result["_trace"] exists
      2. result["_trace"]["nonce"] matches audit log
      3. result["_trace"]["skill_hash"] matches Skill source on disk
    """
    _ensure_audit_dir()

    skill_path = Path(skill_file).resolve()
    skill_hash = _hash_file(skill_path)

    trace = {
        "nonce": nonce,
        "skill_hash": skill_hash,
        "skill_file": str(skill_path),
        "skill_version": version,
        "timestamp": time.time(),
        "pid": os.getpid(),
    }

    result["_trace"] = trace

    completion = {
        "event": "completion",
        "nonce": nonce,
        "timestamp": time.time(),
        "iso_time": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "skill_hash": skill_hash,
        "result_keys": list(result.keys()),
        "result_count": len(result.get("patterns", [])),
    }
    with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(completion, ensure_ascii=False) + "\n")

    return result
