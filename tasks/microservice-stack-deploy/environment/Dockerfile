ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

USER root

RUN apt-get update && apt-get install -y --no-install-recommends nginx && rm -rf /var/lib/apt/lists/*
RUN pip install --break-system-packages flask grpcio grpcio-tools protobuf requests

COPY email-mock/ /workspace/environment/email-mock/
COPY services/ /workspace/services/

RUN mkdir -p /workspace/output /logs/verifier /var/www/html

# --- Pre-existing (broken) infrastructure from the old docker-compose deployment ---

# Stale Nginx config from the multi-container era (wrong upstream ports + Docker service names)
# upstream kv_grpc intentionally lists port 3000 — a previous engineer copy-pasted from the frontend dev server.
RUN rm -f /etc/nginx/sites-enabled/default && \
    printf 'upstream api_backend {\n    server api-server:5000;\n}\n\nupstream kv_grpc {\n    server kvstore:3000;\n}\n\nserver {\n    listen 80;\n    server_name localhost;\n\n    root /var/www/html;\n    index index.html;\n\n    location /api/ {\n        proxy_pass http://api_backend;\n    }\n}\n' \
    > /etc/nginx/conf.d/stack.conf

# Stale docker-compose.yml left in workspace (noise / red herring) — lists kv-store on 8080 (drift vs README which says 9000)
RUN printf 'version: \"3.8\"\nservices:\n  kv-store:\n    build: ./kv-store\n    ports:\n      - \"8080:8080\"\n    environment:\n      GRPC_PORT: 8080\n  api-server:\n    build: ./api-server\n    ports:\n      - \"5000:5000\"\n    environment:\n      KV_STORE_HOST: kv-store:8080\n    depends_on:\n      - kv-store\n  frontend:\n    image: nginx:alpine\n    ports:\n      - \"80:80\"\n    volumes:\n      - ./frontend/index.html:/usr/share/nginx/html/index.html\n    depends_on:\n      - api-server\n' > /workspace/services/docker-compose.yml

# .env vs .env.example drift — .env.example says 9000 (matches README), .env says 8080 (matches compose).
RUN printf '# Copy to .env and fill in.\nKV_STORE_HOST=kvstore:9000\nAPI_PORT=5000\n' > /workspace/services/.env.example && \
    printf 'KV_STORE_HOST=kvstore:8080\nAPI_PORT=5000\n' > /workspace/services/.env

# Old deployment log
RUN mkdir -p /var/log/deploy && \
    printf '[2026-02-10 09:00] Stack deployed via docker-compose up -d\n[2026-02-10 09:01] api-server connected to kv-store:50051\n[2026-02-15 14:30] Nginx reloaded — proxy_pass updated\n[2026-03-01 11:22] kv-store migrated to port 50052 (conflict with monitoring)\n[2026-03-01 11:25] api-server still points to 50051 — TODO: update env\n[2026-04-05 16:00] Stack decommissioned for container migration\n' \
    > /var/log/deploy/history.log

# Port conflict: a leftover metrics collector on 5000
COPY scripts/metrics_stub.py /workspace/environment/scripts/metrics_stub.py

COPY entrypoint.sh /entrypoint.sh
COPY startup.sh /startup.sh
RUN chmod +x /entrypoint.sh /startup.sh

HEALTHCHECK CMD true
CMD ["sleep", "infinity"]
ENTRYPOINT ["/entrypoint.sh"]
