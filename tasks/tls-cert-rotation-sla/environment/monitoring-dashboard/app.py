#!/usr/bin/env python3
"""
Monitoring Dashboard — Flask app on port 3000.

Displays:
- TLS certificate expiry countdown
- HTTPS availability status (from probe log)
- Recent downtime events
"""

import datetime
import os
import subprocess

from flask import Flask, jsonify

app = Flask(__name__)

PROBE_LOG = "/workspace/monitoring/probe.log"
DOWNTIME_FILE = "/workspace/monitoring/downtime_seconds.txt"
CERT_PATH = "/etc/nginx/ssl/server.crt"


def get_cert_expiry():
    """Read the TLS certificate and return expiry info."""
    try:
        result = subprocess.run(
            ["openssl", "x509", "-in", CERT_PATH, "-noout", "-enddate"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            return {"error": "Cannot read certificate", "raw": result.stderr}

        # Parse: notAfter=Apr 12 17:30:00 2026 GMT
        line = result.stdout.strip()
        date_str = line.split("=", 1)[1]
        expiry = datetime.datetime.strptime(date_str, "%b %d %H:%M:%S %Y %Z")
        expiry = expiry.replace(tzinfo=datetime.timezone.utc)
        now = datetime.datetime.now(datetime.timezone.utc)
        remaining = expiry - now
        total_seconds = int(remaining.total_seconds())

        return {
            "expires_at": expiry.isoformat(),
            "remaining_seconds": total_seconds,
            "remaining_human": str(remaining),
            "expired": total_seconds <= 0,
            "critical": 0 < total_seconds < 900,  # < 15 min
        }
    except Exception as e:
        return {"error": str(e)}


def get_probe_status():
    """Read the last N probe entries."""
    entries = []
    try:
        if os.path.exists(PROBE_LOG):
            with open(PROBE_LOG) as f:
                lines = f.readlines()
            for line in lines[-20:]:
                parts = line.strip().split()
                if len(parts) >= 3:
                    entries.append(
                        {
                            "timestamp": parts[0],
                            "status": parts[1],
                            "http_code": parts[2],
                        }
                    )
    except Exception:
        pass

    # Read downtime
    downtime = 0
    try:
        if os.path.exists(DOWNTIME_FILE):
            with open(DOWNTIME_FILE) as f:
                downtime = int(f.read().strip())
    except Exception:
        pass

    return {
        "recent_probes": entries,
        "total_downtime_seconds": downtime,
        "probe_count": len(entries),
    }


DASHBOARD_HTML = """<!DOCTYPE html>
<html>
<head>
    <title>TLS Monitoring Dashboard</title>
    <meta http-equiv="refresh" content="5">
    <style>
        body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
        .card { background: #16213e; border-radius: 8px; padding: 15px; margin: 10px 0;
                border-left: 4px solid #0f3460; }
        .critical { border-left-color: #e94560; }
        .ok { border-left-color: #00b894; }
        .warning { border-left-color: #fdcb6e; }
        h1 { color: #e94560; }
        h2 { color: #a29bfe; margin-bottom: 5px; }
        .metric { font-size: 1.6em; font-weight: bold; }
        .status-up { color: #00b894; }
        .status-down { color: #e94560; }
        table { border-collapse: collapse; width: 100%; }
        td, th { padding: 6px 12px; text-align: left; border-bottom: 1px solid #333; }
    </style>
</head>
<body>
    <h1>🔒 TLS Certificate Monitoring</h1>

    <div class="card {{ 'critical' if cert.critical or cert.expired else 'ok' }}">
        <h2>Certificate Status</h2>
        {% if cert.error %}
            <p class="metric status-down">ERROR: {{ cert.error }}</p>
        {% elif cert.expired %}
            <p class="metric status-down">⚠ EXPIRED</p>
            <p>Expired at: {{ cert.expires_at }}</p>
        {% elif cert.critical %}
            <p class="metric status-down">⚠ CRITICAL — Expiring soon!</p>
            <p>Expires at: {{ cert.expires_at }}</p>
            <p>Remaining: {{ cert.remaining_human }}</p>
        {% else %}
            <p class="metric status-up">✓ Valid</p>
            <p>Expires at: {{ cert.expires_at }}</p>
            <p>Remaining: {{ cert.remaining_human }}</p>
        {% endif %}
    </div>

    <div class="card {{ 'critical' if probe.total_downtime_seconds > 30 else 'ok' }}">
        <h2>HTTPS Availability</h2>
        <p class="metric">Downtime: {{ probe.total_downtime_seconds }}s
            {% if probe.total_downtime_seconds > 30 %}
                <span class="status-down">⚠ SLA BREACH (>30s)</span>
            {% elif probe.total_downtime_seconds > 0 %}
                <span class="warning">⚡ Some downtime recorded</span>
            {% else %}
                <span class="status-up">✓ Within SLA</span>
            {% endif %}
        </p>
        <p>Probes recorded: {{ probe.probe_count }}</p>
    </div>

    <div class="card">
        <h2>Recent Probe Results (last 20)</h2>
        <table>
            <tr><th>Time</th><th>Status</th><th>HTTP Code</th></tr>
            {% for entry in probe.recent_probes | reverse %}
            <tr>
                <td>{{ entry.timestamp }}</td>
                <td class="{{ 'status-up' if entry.status == 'UP' else 'status-down' }}">
                    {{ entry.status }}
                </td>
                <td>{{ entry.http_code }}</td>
            </tr>
            {% endfor %}
        </table>
    </div>

    <p style="color: #666; margin-top: 20px;">Auto-refreshes every 5 seconds. Dashboard port: 3000</p>
</body>
</html>
"""


@app.route("/")
def dashboard():
    from flask import render_template_string

    cert = get_cert_expiry()
    probe = get_probe_status()
    return render_template_string(DASHBOARD_HTML, cert=cert, probe=probe)


@app.route("/api/cert")
def api_cert():
    return jsonify(get_cert_expiry())


@app.route("/api/probe")
def api_probe():
    return jsonify(get_probe_status())


@app.route("/api/status")
def api_status():
    return jsonify({"cert": get_cert_expiry(), "probe": get_probe_status()})


if __name__ == "__main__":
    print("[monitoring] Dashboard starting on port 3000")
    app.run(host="0.0.0.0", port=3000, debug=False)
