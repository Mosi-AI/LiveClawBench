#!/usr/bin/env python3
"""
Verification for monitoring-alerting-setup task (elevated difficulty v2).

Gate checks (all must pass for any score):
  - Prometheus config has scrape targets
  - monitoring_setup_guide.md exists with ≥100 words

Scored dimensions (1.0 total, only evaluated if all gates pass):
  - metrics          (0.30): /metrics endpoints on services, typo fix
  - grafana          (0.25): Grafana dashboard created via API
  - alerting         (0.30): alert rules + active_alerts.json quality
  - file_fingerprint (0.15): api_server.py edited in-place (not rewritten)
"""

import json
import os
import sys
import time
import urllib.request


def http_get(url, timeout=5):
    try:
        req = urllib.request.Request(url)
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.status, resp.read().decode("utf-8", errors="replace")
    except Exception as e:
        return 0, str(e)


def baseline_guard():
    indicators = []

    if os.path.exists("/workspace/prometheus/prometheus.yml"):
        indicators.append("prometheus_config")
    if os.path.exists("/workspace/output/monitoring_setup_guide.md"):
        indicators.append("guide")
    if os.path.exists("/workspace/alerts"):
        indicators.append("alerts_dir")

    if len(indicators) < 1:
        print("BASELINE GUARD: No agent activity detected")
        print("Score: 0.00/1.0")
        sys.exit(1)

    print(f"BASELINE GUARD: Agent activity confirmed ({indicators})")


# === Gate checks ==============================================================


def gate_prometheus_config() -> bool:
    """prometheus.yml must exist with scrape targets."""
    config_path = "/workspace/prometheus/prometheus.yml"
    if not os.path.exists(config_path):
        print("GATE FAIL [prometheus]: prometheus.yml not found")
        return False

    with open(config_path) as f:
        content = f.read()

    has_scrape = "scrape_configs" in content
    has_5000 = "5000" in content
    has_5001 = "5001" in content

    if has_scrape and (has_5000 or has_5001):
        print("GATE PASS [prometheus]: prometheus.yml has scrape config")
        return True

    print("GATE FAIL [prometheus]: prometheus.yml missing scrape configs or targets")
    return False


def gate_guide_exists() -> bool:
    """monitoring_setup_guide.md must exist with ≥100 words."""
    guide_path = "/workspace/output/monitoring_setup_guide.md"
    if not os.path.exists(guide_path):
        print("GATE FAIL [guide]: monitoring_setup_guide.md not found")
        return False

    with open(guide_path) as f:
        content = f.read()
    word_count = len(content.split())
    if word_count < 100:
        print(f"GATE FAIL [guide]: guide too short ({word_count} words, need ≥100)")
        return False

    print(f"GATE PASS [guide]: guide exists ({word_count} words)")
    return True


# === Scored dimensions ========================================================


def check_metrics() -> float:
    """Metrics endpoints + typo fix verification (scored 0-1)."""
    score = 0.0
    total_points = 2  # 2 services

    for port in [5000, 5001]:
        code, body = http_get(f"http://localhost:{port}/metrics")
        if code != 200:
            print(f"  metrics: :{port} returned status {code}")
            continue

        has_typo = "http_requests_totall" in body
        has_correct = (
            "http_requests_total " in body
            or "http_requests_total{" in body
            or "http_requests_total\n" in body
        )
        has_any_metric = any(
            m in body
            for m in (
                "request_count",
                "error_count",
                "response_time",
                "http_requests_total",
            )
        )

        if has_any_metric and has_correct and not has_typo:
            score += 1
            print(f"  metrics: :{port} PASS (canonical metrics, typo fixed)")
        elif has_typo and has_any_metric:
            score += 0.3
            print(f"  metrics: :{port} PARTIAL (typo 'http_requests_totall' not fixed)")
        elif has_any_metric:
            score += 0.5
            print(f"  metrics: :{port} PARTIAL (metrics present but name mismatch)")
        else:
            score += 0.2
            print(f"  metrics: :{port} PARTIAL (200 but missing expected metrics)")

    final = score / total_points
    print(f"  metrics total: {final:.2f}")
    return final


def check_grafana() -> float:
    """Grafana dashboard via API (scored 0-1)."""
    code, body = http_get("http://localhost:3000/api/search")
    if code == 200:
        try:
            dashboards = json.loads(body)
            if len(dashboards) >= 2:
                print(f"  grafana: 1.00 ({len(dashboards)} dashboards)")
                return 1.0
            elif len(dashboards) == 1:
                print("  grafana: 0.70 (1 dashboard)")
                return 0.70
            else:
                print("  grafana: 0.00 (no dashboards)")
                return 0.0
        except json.JSONDecodeError:
            print("  grafana: 0.00 (invalid JSON from /api/search)")
            return 0.0
    else:
        print(f"  grafana: 0.00 (Grafana /api/search status={code})")
        return 0.0


def check_alerting() -> float:
    """Alert rules + active_alerts.json quality (scored 0-1)."""
    alerts_path = "/workspace/alerts/active_alerts.json"

    if not os.path.exists(alerts_path):
        for path in [
            "/workspace/prometheus/alert_rules.yml",
            "/workspace/alerts/rules.yml",
        ]:
            if os.path.exists(path):
                print("  alerting: 0.20 (rule file found but no active_alerts.json)")
                return 0.20
        print("  alerting: 0.00 (no alert files found)")
        return 0.0

    try:
        with open(alerts_path) as f:
            content = f.read().strip()
        if not content:
            print("  alerting: 0.10 (active_alerts.json empty)")
            return 0.10
        data = json.loads(content)
    except json.JSONDecodeError:
        print("  alerting: 0.10 (active_alerts.json invalid JSON)")
        return 0.10

    alerts = data if isinstance(data, list) else [data]
    if len(alerts) == 0:
        print("  alerting: 0.10 (no alert entries)")
        return 0.10

    # Check required fields
    required_fields = {"alert_name", "metric_name", "threshold", "current_value"}
    score = 0.0

    valid_alerts = 0
    for alert in alerts:
        if isinstance(alert, dict) and required_fields.issubset(set(alert.keys())):
            valid_alerts += 1

    if valid_alerts > 0:
        score += 0.50
    else:
        partial_fields = 0
        if len(alerts) > 0 and isinstance(alerts[0], dict):
            partial_fields = len(required_fields & set(alerts[0].keys()))
        if partial_fields >= 2:
            score += 0.25
        else:
            score += 0.15

    # Validate metric_name against real Prometheus metrics
    if valid_alerts > 0:
        real_metrics = set()
        for port in [5000, 5001]:
            code, body = http_get(f"http://localhost:{port}/metrics")
            if code == 200:
                for line in body.split("\n"):
                    if line and not line.startswith("#"):
                        metric_name = line.split("{")[0].split(" ")[0]
                        if metric_name:
                            real_metrics.add(metric_name)

        if real_metrics:
            metric_match = any(
                isinstance(a, dict) and a.get("metric_name") in real_metrics
                for a in alerts
            )
            if metric_match:
                score += 0.50
                print(
                    f"  alerting: {score:.2f} ({valid_alerts} valid alerts, metric match)"
                )
            else:
                score += 0.15
                print(
                    f"  alerting: {score:.2f} ({valid_alerts} valid alerts, metric mismatch)"
                )
        else:
            score += 0.25
            print(
                f"  alerting: {score:.2f} ({valid_alerts} valid alerts, cannot verify metrics)"
            )
    else:
        print(f"  alerting: {score:.2f} (no alerts with all required fields)")

    return min(score, 1.0)


def check_file_fingerprint() -> float:
    """api_server.py must preserve ops fingerprint (in-place edit, not rewrite) (scored 0-1)."""
    path = "/workspace/services/api_server.py"
    if not os.path.exists(path):
        print("  file_fingerprint: 0.00 (api_server.py missing)")
        return 0.0
    with open(path) as f:
        content = f.read()
    if "ops-a7f3e9c2b1d8-monitoring-v2" in content:
        print("  file_fingerprint: 1.00 (fingerprint preserved)")
        return 1.0
    print("  file_fingerprint: 0.00 (fingerprint missing — wholesale rewrite)")
    return 0.0


def main():
    baseline_guard()
    time.sleep(2)

    # === Gate checks ==========================================================
    gate_results = {}
    gate_results["prometheus_config"] = gate_prometheus_config()
    gate_results["guide_exists"] = gate_guide_exists()

    gates_passed = all(gate_results.values())
    failed_gates = [k for k, v in gate_results.items() if not v]

    if not gates_passed:
        print(f"\nGATE FAILURE: {failed_gates}")
        print("Score: 0.00/1.0")
        try:
            os.makedirs("/logs/verifier", exist_ok=True)
            with open("/logs/verifier/reward.json", "w") as f:
                json.dump(
                    {
                        "reward": 0.0,
                        **{
                            f"gate_{k}": (1 if v else 0)
                            for k, v in gate_results.items()
                        },
                    },
                    f,
                    indent=2,
                )
        except Exception:
            pass
        sys.exit(1)

    print("\nAll gates passed — scoring dimensions...\n")

    # === Scored dimensions ====================================================
    weights = {
        "metrics": 0.30,
        "grafana": 0.25,
        "alerting": 0.30,
        "file_fingerprint": 0.15,
    }

    raw_scores = {}
    raw_scores["metrics"] = check_metrics()
    raw_scores["grafana"] = check_grafana()
    raw_scores["alerting"] = check_alerting()
    raw_scores["file_fingerprint"] = check_file_fingerprint()

    total = sum(raw_scores[k] * weights[k] for k in weights)
    total = round(total, 2)

    print("\n=== Score Breakdown ===")
    for key, weight in weights.items():
        s = raw_scores[key]
        print(f"  {key}: {s:.2f} x {weight:.2f} = {s * weight:.3f}")
    print(f"\nScore: {total}/1.0")

    try:
        os.makedirs("/logs/verifier", exist_ok=True)
        reward_data = {
            "reward": total,
            **{f"gate_{k}": 1 for k in gate_results},
        }
        for key, weight in weights.items():
            reward_data[key] = round(raw_scores[key] * weight, 3)
        with open("/logs/verifier/reward.json", "w") as f:
            json.dump(reward_data, f, indent=2)
    except Exception:
        pass

    sys.exit(0 if total >= 0.5 else 1)


if __name__ == "__main__":
    main()
