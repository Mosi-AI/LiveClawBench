"""Grafana Mock — lightweight Flask app simulating Grafana's Dashboard API.
Runs on port 3000.
"""

import json
import os
import time

from flask import Flask, jsonify, request

app = Flask(__name__)

# In-memory storage
_datasources = []
_dashboards = []
_next_ds_id = 1
_next_db_id = 1


@app.route("/")
def index():
    return """<html><head><title>Grafana</title></head>
<body><h1>Grafana Mock</h1>
<p>Dashboard API available at /api/dashboards/db</p>
<p>Datasource API available at /api/datasources</p>
</body></html>"""


# ---- Datasource API ----
@app.route("/api/datasources", methods=["GET"])
def list_datasources():
    return jsonify(_datasources)


@app.route("/api/datasources", methods=["POST"])
def create_datasource():
    global _next_ds_id
    body = request.get_json(force=True)
    ds = {
        "id": _next_ds_id,
        "name": body.get("name", f"datasource-{_next_ds_id}"),
        "type": body.get("type", "prometheus"),
        "url": body.get("url", ""),
        "access": body.get("access", "proxy"),
        "isDefault": body.get("isDefault", False),
    }
    _datasources.append(ds)
    _next_ds_id += 1
    return jsonify(
        {"id": ds["id"], "message": "Datasource added", "name": ds["name"]}
    ), 200


# ---- Dashboard API ----
@app.route("/api/dashboards/db", methods=["POST"])
def create_dashboard():
    global _next_db_id
    body = request.get_json(force=True)
    dashboard = body.get("dashboard", {})
    dashboard["id"] = _next_db_id
    dashboard["uid"] = f"dash-{_next_db_id}"
    dashboard["version"] = 1

    entry = {
        "id": _next_db_id,
        "uid": dashboard["uid"],
        "title": dashboard.get("title", "Untitled"),
        "dashboard": dashboard,
        "overwrite": body.get("overwrite", False),
        "created_at": time.time(),
    }
    _dashboards.append(entry)
    _next_db_id += 1

    return jsonify(
        {
            "id": entry["id"],
            "uid": entry["uid"],
            "url": f"/d/{entry['uid']}",
            "status": "success",
            "version": 1,
        }
    ), 200


@app.route("/api/search", methods=["GET"])
def search_dashboards():
    results = []
    for d in _dashboards:
        results.append(
            {
                "id": d["id"],
                "uid": d["uid"],
                "title": d["title"],
                "type": "dash-db",
            }
        )
    return jsonify(results)


@app.route("/api/dashboards/uid/<uid>", methods=["GET"])
def get_dashboard(uid):
    for d in _dashboards:
        if d["uid"] == uid:
            return jsonify({"dashboard": d["dashboard"], "meta": {"slug": d["title"]}})
    return jsonify({"message": "Dashboard not found"}), 404


# Persist dashboards to disk for verification
@app.route("/api/admin/export", methods=["GET"])
def export_all():
    data = {"datasources": _datasources, "dashboards": _dashboards}
    os.makedirs("/workspace/grafana-data", exist_ok=True)
    with open("/workspace/grafana-data/export.json", "w") as f:
        json.dump(data, f, indent=2)
    return jsonify(
        {"status": "exported", "path": "/workspace/grafana-data/export.json"}
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
