#!/usr/bin/env python3
"""
verify.py — Verifier for tls-cert-rotation-sla task (elevated difficulty v2).

Gate checks (all must pass for any score):
  - HTTPS functional (curl -k https://localhost returns 200)
  - Certificate renewed (fingerprint differs + expiry > 300d)
  - Logging fixed (access.log has recent entries)

Scored dimensions (1.0 total, only evaluated if all gates pass):
  - downtime_sla   (0.50): SLA tightened to ≤5s; no monitoring data = fail
  - runbook_quality (0.50): ≥200 words, covers cert + nginx + monitoring
"""

import datetime
import json
import os
import subprocess
import sys
import time

CERT_PATH = "/etc/nginx/ssl/server.crt"
ORIGINAL_FINGERPRINT_FILE = "/var/run/original_cert_fingerprint"
ACCESS_LOG = "/var/log/nginx/access.log"
DOWNTIME_FILE = "/workspace/monitoring/downtime_seconds.txt"
PROBE_LOG = "/workspace/monitoring/probe.log"


def run_cmd(cmd, timeout=15):
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return result.returncode, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return -1, "", "timeout"
    except Exception as e:
        return -1, "", str(e)


def baseline_guard():
    """Check agent actually performed rotation work."""
    indicators = []

    if os.path.exists(CERT_PATH):
        cert_mtime = os.path.getmtime(CERT_PATH)
        if time.time() - cert_mtime < 7200:
            indicators.append("cert_modified")

    for path in [
        "/workspace/output/tls_rotation_runbook.md",
        "/workspace/output/runbook.md",
        "/workspace/output/tls_rotation.md",
    ]:
        if os.path.exists(path):
            indicators.append("runbook")
            break

    rc, out, _ = run_cmd(
        "journalctl -u nginx --since '2 hours ago' 2>/dev/null | tail -5"
    )
    if rc == 0 and out:
        indicators.append("nginx_activity")

    if len(indicators) < 1:
        print("BASELINE GUARD: No agent activity detected")
        print("Score: 0.00/1.0")
        sys.exit(1)

    print(f"BASELINE GUARD: Agent activity confirmed ({indicators})")


# === Gate checks ==============================================================


def gate_https_functional() -> bool:
    """HTTPS must return 200 or redirect."""
    try:
        result = subprocess.run(
            [
                "curl",
                "-sk",
                "-o",
                "/dev/null",
                "-w",
                "%{http_code}",
                "--connect-timeout",
                "5",
                "--max-time",
                "10",
                "https://localhost",
            ],
            capture_output=True,
            text=True,
            timeout=15,
        )
        http_code = result.stdout.strip()
        if http_code in ("200", "301", "302"):
            print(f"GATE PASS [https]: HTTPS returns {http_code}")
            return True
        print(f"GATE FAIL [https]: HTTPS returns {http_code}")
        return False
    except Exception as e:
        print(f"GATE FAIL [https]: Could not connect: {e}")
        return False


def gate_certificate_renewed() -> bool:
    """Cert must have new fingerprint and long validity (>300d)."""
    try:
        rc, current_fp, _ = run_cmd(
            f"openssl x509 -in {CERT_PATH} -noout -fingerprint -sha256"
        )
        if rc != 0:
            print("GATE FAIL [cert]: Cannot read current certificate")
            return False

        if os.path.exists(ORIGINAL_FINGERPRINT_FILE):
            with open(ORIGINAL_FINGERPRINT_FILE) as f:
                original_fp = f.read().strip()
            if current_fp.strip() == original_fp.strip():
                print(
                    "GATE FAIL [cert]: Certificate not rotated (fingerprint unchanged)"
                )
                return False

        rc, line, _ = run_cmd(f"openssl x509 -in {CERT_PATH} -noout -enddate")
        if rc != 0:
            print("GATE FAIL [cert]: Cannot read cert expiry")
            return False

        date_str = line.split("=", 1)[1]
        expiry = datetime.datetime.strptime(date_str, "%b %d %H:%M:%S %Y %Z")
        expiry = expiry.replace(tzinfo=datetime.timezone.utc)
        now = datetime.datetime.now(datetime.timezone.utc)
        days_remaining = (expiry - now).days

        if days_remaining > 300:
            print(f"GATE PASS [cert]: New cert valid for {days_remaining} days")
            return True
        print(
            f"GATE FAIL [cert]: New cert only valid {days_remaining} days (need >300)"
        )
        return False

    except Exception as e:
        print(f"GATE FAIL [cert]: Error: {e}")
        return False


def gate_logging_fixed() -> bool:
    """access.log must have recent valid entries."""
    try:
        for _ in range(3):
            subprocess.run(
                ["curl", "-sk", "https://localhost/", "-o", "/dev/null"],
                capture_output=True,
                timeout=5,
            )
        time.sleep(1)

        if not os.path.exists(ACCESS_LOG):
            print("GATE FAIL [logging]: access.log does not exist")
            return False

        with open(ACCESS_LOG) as f:
            content = f.read()

        lines = [line.strip() for line in content.split("\n") if line.strip()]
        if len(lines) == 0:
            print("GATE FAIL [logging]: access.log is empty")
            return False

        valid = [
            line
            for line in lines
            if ("GET" in line or "POST" in line)
            and ("200" in line or "301" in line or "304" in line)
        ]
        if len(valid) >= 1:
            print(f"GATE PASS [logging]: access.log has {len(valid)} valid entries")
            return True
        print(
            f"GATE FAIL [logging]: access.log has {len(lines)} lines but no well-formed entries"
        )
        return False

    except Exception as e:
        print(f"GATE FAIL [logging]: Error: {e}")
        return False


# === Scored dimensions ========================================================


def check_downtime_sla() -> float:
    """SLA tightened to ≤5s. No monitoring data = fail."""
    try:
        downtime = None

        if os.path.exists(DOWNTIME_FILE):
            with open(DOWNTIME_FILE) as f:
                try:
                    downtime = int(f.read().strip())
                except ValueError:
                    downtime = None

        if downtime is None and os.path.exists(PROBE_LOG):
            with open(PROBE_LOG) as f:
                lines = f.readlines()
            if len(lines) > 0:
                down_count = sum(1 for line in lines if "DOWN" in line)
                downtime = down_count * 5

        if downtime is None:
            print("  downtime_sla: 0.00 (no monitoring data)")
            return 0.0

        if downtime <= 5:
            print(f"  downtime_sla: 1.00 (downtime={downtime}s, SLA ≤5s)")
            return 1.0
        elif downtime <= 10:
            print(f"  downtime_sla: 0.60 (downtime={downtime}s, SLA ≤5s)")
            return 0.60
        elif downtime <= 20:
            print(f"  downtime_sla: 0.30 (downtime={downtime}s, SLA ≤5s)")
            return 0.30
        elif downtime <= 30:
            print(f"  downtime_sla: 0.15 (downtime={downtime}s, SLA ≤5s)")
            return 0.15
        else:
            print(f"  downtime_sla: 0.00 (downtime={downtime}s, SLA ≤5s)")
            return 0.0

    except Exception as e:
        print(f"  downtime_sla: 0.00 (error: {e})")
        return 0.0


def check_runbook_quality() -> float:
    """Require ≥200 words, cover cert generation + nginx config + monitoring."""
    runbook_path = None
    for path in [
        "/workspace/output/tls_rotation_runbook.md",
        "/workspace/output/tls_rotation.md",
        "/workspace/output/runbook.md",
    ]:
        if os.path.exists(path):
            runbook_path = path
            break

    if runbook_path is None:
        output_dir = "/workspace/output"
        if os.path.isdir(output_dir):
            for fname in os.listdir(output_dir):
                if fname.endswith(".md"):
                    runbook_path = os.path.join(output_dir, fname)
                    break

    if runbook_path is None:
        print("  runbook_quality: 0.00 (no runbook found)")
        return 0.0

    with open(runbook_path) as f:
        content = f.read()

    word_count = len(content.split())
    content_lower = content.lower()

    if word_count < 100:
        print(f"  runbook_quality: 0.00 (too short: {word_count} words)")
        return 0.0

    score = 0.0

    # Word count tier
    if word_count >= 200:
        score += 0.3
    elif word_count >= 150:
        score += 0.2
    else:
        score += 0.1

    # Concept coverage
    concept_groups = {
        "cert_generation": [
            "openssl",
            "certificate",
            "cert",
            "x509",
            "key",
            "csr",
            "pem",
        ],
        "nginx_config": ["nginx", "ssl_certificate", "server", "reload", "restart"],
        "monitoring": ["monitor", "downtime", "probe", "health", "check", "sla"],
    }

    groups_found = 0
    for group_name, keywords in concept_groups.items():
        if any(kw in content_lower for kw in keywords):
            groups_found += 1

    if groups_found >= 3:
        score += 0.7
    elif groups_found >= 2:
        score += 0.5
    elif groups_found >= 1:
        score += 0.3

    # Placeholder penalty
    placeholder_count = (
        content.count("[FILL") + content.count("[TO BE") + content.count("[TODO")
    )
    if placeholder_count > 5:
        score *= 0.5
        print(f"  PENALTY: {placeholder_count} unfilled placeholders")

    final = min(score, 1.0)
    print(
        f"  runbook_quality: {final:.2f} ({word_count} words, {groups_found}/3 concepts)"
    )
    return final


def main():
    baseline_guard()

    # === Gate checks ==========================================================
    gate_results = {}
    gate_results["https_functional"] = gate_https_functional()
    gate_results["certificate_renewed"] = gate_certificate_renewed()
    gate_results["logging_fixed"] = gate_logging_fixed()

    gates_passed = all(gate_results.values())
    failed_gates = [k for k, v in gate_results.items() if not v]

    if not gates_passed:
        print(f"\nGATE FAILURE: {failed_gates}")
        print("Score: 0.00/1.0")
        os.makedirs("/logs/verifier", exist_ok=True)
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(
                {
                    "reward": 0.0,
                    **{f"gate_{k}": (1 if v else 0) for k, v in gate_results.items()},
                },
                f,
                indent=2,
            )
        sys.exit(1)

    print("\nAll gates passed — scoring dimensions...\n")

    # === Scored dimensions ====================================================
    weights = {
        "downtime_sla": 0.50,
        "runbook_quality": 0.50,
    }

    raw_scores = {}
    raw_scores["downtime_sla"] = check_downtime_sla()
    raw_scores["runbook_quality"] = check_runbook_quality()

    total = sum(raw_scores[k] * weights[k] for k in weights)
    total = round(total, 2)

    print("\n=== Score Breakdown ===")
    for key, weight in weights.items():
        s = raw_scores[key]
        print(f"  {key}: {s:.2f} x {weight:.2f} = {s * weight:.3f}")
    print(f"\nScore: {total}/1.0")

    os.makedirs("/logs/verifier", exist_ok=True)
    reward_data = {
        "reward": total,
        **{f"gate_{k}": 1 for k in gate_results},
    }
    for key, weight in weights.items():
        reward_data[key] = round(raw_scores[key] * weight, 3)
    with open("/logs/verifier/reward.json", "w") as f:
        json.dump(reward_data, f, indent=2)

    sys.exit(0 if total >= 0.5 else 1)


if __name__ == "__main__":
    main()
