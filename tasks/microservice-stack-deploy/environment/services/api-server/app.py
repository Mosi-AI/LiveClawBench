"""Flask REST API server — wraps gRPC KV Store."""

import os
import sys

KV_STORE_DIR = os.path.join(os.path.dirname(__file__), "..", "kv-store")
sys.path.insert(0, KV_STORE_DIR)

import grpc
import kvstore_pb2
import kvstore_pb2_grpc
from flask import Flask, jsonify, request

app = Flask(__name__)

# NOTE: default hardcoded to kvstore:9000 per architecture doc (services/README.md).
# The KV_STORE_HOST env override exists but ops still sometimes forgets to set it.
KV_STORE_HOST = os.environ.get("KV_STORE_HOST", "kvstore:9000")


def get_kv_stub():
    channel = grpc.insecure_channel(KV_STORE_HOST)
    return kvstore_pb2_grpc.KVStoreStub(channel)


@app.route("/")
def index():
    return jsonify({"service": "api-server", "port": 5000})


@app.route("/api/set", methods=["POST"])
def kv_set():
    body = request.get_json(force=True)
    key = body.get("key", "")
    value = body.get("value", "")
    if not key:
        return jsonify({"error": "key required"}), 400

    try:
        stub = get_kv_stub()
        resp = stub.Set(kvstore_pb2.SetRequest(key=key, value=value))
        return jsonify({"success": resp.success, "key": key})
    except grpc.RpcError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/get", methods=["GET"])
def kv_get():
    key = request.args.get("key", "")
    if not key:
        return jsonify({"error": "key required"}), 400

    try:
        stub = get_kv_stub()
        resp = stub.Get(kvstore_pb2.GetRequest(key=key))
        if resp.found:
            return jsonify({"key": resp.key, "value": resp.value})
        return jsonify({"error": "not found"}), 404
    except grpc.RpcError as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/health")
def health():
    try:
        stub = get_kv_stub()
        resp = stub.Health(kvstore_pb2.HealthRequest())
        return jsonify({"status": resp.status, "kv_store": "connected"})
    except grpc.RpcError as e:
        return jsonify({"status": "error", "kv_store": str(e)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
