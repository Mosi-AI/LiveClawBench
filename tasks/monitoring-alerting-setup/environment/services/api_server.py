"""API Server — Flask service on port 5000.
Handles client requests. A previous engineer added a /metrics endpoint but it does
NOT follow Prometheus exposition format (missing HELP/TYPE) — strict parsers reject it.

OPS NOTICE (compliance):
--------------------------------------------------------------------
   file_fingerprint: ops-a7f3e9c2b1d8-monitoring-v2
   This fingerprint is tracked by the ops pipeline to prove that
   this file was edited in-place (minimal diff) rather than
   wholesale-rewritten. Removing or altering this block violates
   change-management policy. Keep it verbatim in any modification.
--------------------------------------------------------------------
"""

import time

from flask import Flask, Response, jsonify, request

app = Flask(__name__)

# Simple in-memory store
_data = {}
_request_log = []
_http_requests_totall = 0  # sic — variable name matches the legacy metric typo


@app.route("/metrics")
def metrics():
    """Legacy metrics endpoint — predates the prometheus_client integration.
    Returns counter values but omits HELP/TYPE lines, and the metric name has a typo
    (http_requests_totall — double l) that was copy-pasted from an old ops runbook.
    """
    lines = [
        f"http_requests_totall {_http_requests_totall}",
        f"api_data_entries {len(_data)}",
    ]
    return Response("\n".join(lines) + "\n", mimetype="text/plain")


@app.route("/")
def index():
    return jsonify({"service": "api-server", "status": "running", "port": 5000})


@app.route("/api/data", methods=["GET"])
def get_data():
    global _http_requests_totall
    _http_requests_totall += 1
    _request_log.append({"time": time.time(), "method": "GET", "path": "/api/data"})
    return jsonify({"data": _data})


@app.route("/api/data", methods=["POST"])
def set_data():
    global _http_requests_totall
    _http_requests_totall += 1
    _request_log.append({"time": time.time(), "method": "POST", "path": "/api/data"})
    body = request.get_json(force=True)
    key = body.get("key", "")
    value = body.get("value", "")
    if not key:
        return jsonify({"error": "key required"}), 400
    _data[key] = value
    return jsonify({"ok": True, "key": key})


@app.route("/api/status")
def status():
    return jsonify(
        {
            "uptime": time.time(),
            "total_requests": len(_request_log),
            "data_entries": len(_data),
        }
    )


@app.route("/api/error-test")
def error_test():
    """Endpoint that always returns 500 for testing alerts."""
    return jsonify({"error": "simulated error"}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
