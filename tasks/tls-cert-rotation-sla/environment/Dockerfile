FROM liveclawbench-base:latest

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

USER root

# Install Nginx and OpenSSL
RUN apt-get update && apt-get install -y --no-install-recommends \
        nginx \
        openssl \
        procps \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies for monitoring dashboard and cert generation
RUN pip3 install --no-cache-dir --break-system-packages flask cryptography

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl /etc/ssl/certs

# Decoy PEM files from a previous (failed) rotation attempt. They exist at the
# path commented into nginx.conf; an agent that blindly trusts that comment and
# points nginx here will fail the HTTPS probe — these are self-signed garbage
# for a different CN and are NOT valid production certs.
RUN for name in server server-old backup; do \
        openssl req -x509 -nodes -newkey rsa:2048 \
            -days 1 \
            -subj "/CN=decoy.invalid" \
            -keyout /etc/ssl/certs/${name}.key \
            -out /etc/ssl/certs/${name}.pem 2>/dev/null ; \
    done

# Copy cert generation script and generate an expiring-soon cert at build time
# (Actual near-expiry cert generated at startup for precise timing)
COPY scripts/generate_expiring_cert.py /usr/local/bin/generate_expiring_cert.py
RUN chmod +x /usr/local/bin/generate_expiring_cert.py

# Copy Nginx config (with intentional log_format syntax error)
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Copy the backend app
COPY backend/app.py /workspace/backend/app.py

# Copy monitoring dashboard
COPY monitoring-dashboard/app.py /workspace/monitoring/app.py
COPY scripts/https_probe.sh /workspace/monitoring/https_probe.sh
RUN chmod +x /workspace/monitoring/https_probe.sh

# Copy runbook template
COPY runbook/tls_rotation.md /workspace/runbook/tls_rotation.md

# Create output directory
RUN mkdir -p /workspace/output

# Create log directories
RUN mkdir -p /var/log/nginx && touch /var/log/nginx/access.log /var/log/nginx/error.log

# Copy startup and entrypoint
COPY startup.sh /workspace/startup.sh
COPY entrypoint.sh /workspace/entrypoint.sh
RUN chmod +x /workspace/startup.sh /workspace/entrypoint.sh

WORKDIR /workspace
ENTRYPOINT ["/workspace/entrypoint.sh"]
CMD ["sh", "-c", "sleep infinity"]
