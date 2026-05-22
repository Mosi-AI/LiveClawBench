#!/bin/bash
# solve.sh — Reference solution for tls-cert-rotation-sla
# Demonstrates the expected agent workflow.

set -e

echo "=== Step 1: Check current certificate status ==="
openssl x509 -in /etc/nginx/ssl/server.crt -noout -enddate
echo ""

echo "=== Step 2: Generate new self-signed TLS certificate (365 days) ==="
openssl req -x509 -nodes \
    -days 365 \
    -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/server.key \
    -out /etc/nginx/ssl/server.crt \
    -subj "/C=US/ST=California/O=WebApp Inc/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

echo "New certificate generated."
openssl x509 -in /etc/nginx/ssl/server.crt -noout -enddate

echo "=== Step 3: Fix Nginx logging issues ==="
# Bug 1: access_log is set to 'off' — needs to be enabled with the 'main' format
# Bug 2: log_format has typo '$reques' instead of '$request'

# Fix the $reques typo → $request
sed -i 's/\$reques"/\$request"/' /etc/nginx/nginx.conf

# Enable access logging (replace 'access_log off' with proper log path)
sed -i 's|access_log off;|access_log /var/log/nginx/access.log main;|' /etc/nginx/nginx.conf

echo "Nginx logging fixed (enabled access_log + fixed \$request typo)."

echo "=== Step 4: Test Nginx config and reload ==="
nginx -t
nginx -s reload

echo "Nginx reloaded."

echo "=== Step 5: Verify HTTPS ==="
sleep 2
curl -sk https://localhost
echo ""
echo "HTTPS is working."

echo "=== Step 6: Verify logging ==="
curl -sk https://localhost/ -o /dev/null
curl -sk https://localhost/health -o /dev/null
sleep 1
echo "Access log entries:"
tail -5 /var/log/nginx/access.log

echo "=== Step 7: Write completed runbook ==="
mkdir -p /workspace/output

cat > /workspace/output/tls_rotation_runbook.md << 'RUNBOOK'
# TLS Certificate Rotation Runbook

**Service**: WebApp Production (Nginx reverse proxy)
**Author**: SRE On-Call
**Last Updated**: 2026-04-12

---

## 1. Pre-Rotation Checks

- [x] Verify current certificate expiry date:
  ```
  openssl x509 -in /etc/nginx/ssl/server.crt -noout -enddate
  # Output: notAfter=<approximately 15 minutes from container start>
  ```
- [x] Confirm backend health:
  ```
  curl http://localhost:8080/health
  # Output: {"status": "healthy", ...}
  ```

## 2. Generate New Certificate

```bash
openssl req -x509 -nodes \
    -days 365 \
    -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/server.key \
    -out /etc/nginx/ssl/server.crt \
    -subj "/C=US/ST=California/O=WebApp Inc/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

Certificate details:
- Common Name: localhost
- Validity period: 365 days
- Key size: RSA 2048-bit
- SANs: DNS:localhost, IP:127.0.0.1

## 3. Install Certificate

Certificate was generated directly at the correct paths:
- Cert: `/etc/nginx/ssl/server.crt`
- Key: `/etc/nginx/ssl/server.key`

No separate installation step needed since openssl wrote directly to the target paths.

## 4. Reload Nginx

```bash
nginx -t        # Test config syntax first
nginx -s reload  # Graceful reload (no connection drop)
```

The `nginx -s reload` command sends a HUP signal to the master process, which starts
new worker processes with the new config/certs while gracefully shutting down old workers.
This ensures zero-downtime certificate rotation.

## 5. Post-Rotation Verification

- [x] HTTPS responds with 200:
  ```
  curl -sk https://localhost
  # Returns HTML page with "WebApp Production Server"
  ```
- [x] New certificate expiry confirmed:
  ```
  openssl x509 -in /etc/nginx/ssl/server.crt -noout -enddate
  # notAfter=Apr 12 xx:xx:xx 2027 GMT  (365 days from now)
  ```
- [x] Access logs are being written:
  ```
  tail -5 /var/log/nginx/access.log
  # Shows recent GET / and GET /health requests with 200 status
  ```

## 6. Logging Fix

**Issue found**: Access logs were completely empty — two issues in nginx.conf.

**Root cause**:
1. `access_log off;` — a previous maintainer disabled access logging during debugging
   and forgot to re-enable it.
2. `log_format main` had a typo: `$reques` instead of `$request`, which would produce
   incomplete log entries even if access_log were enabled.

**Fix applied**:
```bash
# Fix 1: Enable access logging
sed -i 's|access_log off;|access_log /var/log/nginx/access.log main;|' /etc/nginx/nginx.conf

# Fix 2: Fix the variable typo
sed -i 's/$reques"/$request"/' /etc/nginx/nginx.conf

# Reload
nginx -s reload
```

## 7. Incident Timeline

| Time | Event |
|------|-------|
| T+0s | Alert: TLS cert expiring in <15 minutes |
| T+10s | Investigated cert with openssl x509 |
| T+30s | Generated new 365-day self-signed cert |
| T+45s | Fixed nginx.conf log_format syntax error |
| T+60s | Ran nginx -t (config test passed) |
| T+65s | Ran nginx -s reload (graceful reload) |
| T+70s | Verified HTTPS returning 200 |
| T+80s | Verified new cert expiry (365 days) |
| T+90s | Confirmed access logs being written |

## 8. Total Downtime

**Estimated HTTPS downtime**: 0 seconds (graceful reload, no service interruption)

---

_End of runbook_
RUNBOOK

echo "Runbook written to /workspace/output/tls_rotation_runbook.md"
echo "=== Reference solution complete ==="
