ARG OPENCLAW_BASE_IMAGE=ghcr.io/openclaw/openclaw:2026.3.11
FROM ${OPENCLAW_BASE_IMAGE}

WORKDIR /opt/browser_mock

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 ca-certificates sqlite3 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/local/bin/python \
    && mkdir -p /opt/browser_mock /shared

COPY pkb_hybrid_tool_memory_hard_001/environment/browser_mock_sidecar/browser_mock_server.py /opt/browser_mock/browser_mock_server.py
COPY pkb_hybrid_tool_memory_hard_001/environment/browser_mock_sidecar/documents.sql /opt/browser_mock/documents.sql
RUN sqlite3 /opt/browser_mock/documents.sqlite < /opt/browser_mock/documents.sql

HEALTHCHECK --interval=5s --timeout=2s --start-period=5s --retries=12 \
  CMD python3 -c "import json, urllib.request; payload = json.load(urllib.request.urlopen('http://127.0.0.1:8123/health', timeout=1)); raise SystemExit(0 if payload.get('ok') else 1)"

CMD ["python3", "/opt/browser_mock/browser_mock_server.py", "--database", "/opt/browser_mock/documents.sqlite", "--log", "/shared/browser_mock_access.jsonl", "--host", "0.0.0.0", "--port", "8123"]
