#!/bin/bash
# startup.sh — Start all services for the TLS cert rotation task
set -e

echo "[startup] Generating near-expiry TLS certificate..."
python3 /usr/local/bin/generate_expiring_cert.py

# Save the original cert fingerprint for verifier comparison
openssl x509 -in /etc/nginx/ssl/server.crt -noout -fingerprint -sha256 \
    > /var/run/original_cert_fingerprint 2>/dev/null || true
# Also persist under /workspace so the verifier can diff against rotated fingerprints.
openssl x509 -in /etc/nginx/ssl/server.crt -noout -fingerprint -sha256 \
    > /workspace/.cert_fingerprint_original 2>/dev/null || true

echo "[startup] Starting backend app on port 8080..."
cd /workspace/backend
python3 app.py &
sleep 1

echo "[startup] Starting Nginx..."
# nginx.conf has access_log disabled and a log_format typo — Nginx starts fine
# but access logging is broken (agent must fix it)
nginx
sleep 1

echo "[startup] Starting HTTPS availability probe..."
/workspace/monitoring/https_probe.sh &

echo "[startup] Starting monitoring dashboard on port 3000..."
cd /workspace/monitoring
python3 app.py &

echo "[startup] All services started."
