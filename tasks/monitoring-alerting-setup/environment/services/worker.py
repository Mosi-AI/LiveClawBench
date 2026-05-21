"""Worker Service — Flask service on port 5001.
Handles background tasks. Currently has NO /metrics endpoint.
"""

import time

from flask import Flask, jsonify, request

app = Flask(__name__)

_tasks = []
_completed = []


@app.route("/")
def index():
    return jsonify({"service": "worker", "status": "running", "port": 5001})


@app.route("/tasks", methods=["GET"])
def list_tasks():
    return jsonify({"pending": _tasks, "completed": _completed})


@app.route("/tasks", methods=["POST"])
def add_task():
    body = request.get_json(force=True)
    task_name = body.get("name", "unnamed")
    task = {"name": task_name, "created": time.time(), "status": "pending"}
    _tasks.append(task)
    return jsonify({"ok": True, "task": task})


@app.route("/tasks/process", methods=["POST"])
def process_tasks():
    """Process all pending tasks."""
    processed = 0
    while _tasks:
        task = _tasks.pop(0)
        task["status"] = "completed"
        task["completed_at"] = time.time()
        _completed.append(task)
        processed += 1
    return jsonify({"processed": processed})


@app.route("/health")
def health():
    return jsonify(
        {"healthy": True, "pending": len(_tasks), "completed": len(_completed)}
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001)
