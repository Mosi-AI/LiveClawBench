ARG OPENCLAW_BASE_IMAGE=liveclawbench-pricing-matrix-reconcile-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

ENV HOME=/home/node
WORKDIR /home/node/.openclaw

USER root
RUN mkdir -p /home/node/.openclaw/output /home/node/.openclaw/workspace \
    && chown -R node:node /home/node

COPY pricing_server.py /home/node/.openclaw/pricing_server.py
COPY workspace_seed/ /home/node/.openclaw/workspace/
COPY startup.sh /home/node/.openclaw/startup.sh
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /home/node/.openclaw/startup.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
