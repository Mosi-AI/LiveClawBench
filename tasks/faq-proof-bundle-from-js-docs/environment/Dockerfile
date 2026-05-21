ARG OPENCLAW_BASE_IMAGE=liveclawbench-faq-proof-bundle-from-js-docs-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

ENV HOME=/home/node
WORKDIR /home/node/.openclaw

USER root
RUN mkdir -p /home/node/.openclaw/output /home/node/.openclaw/workspace/faq_proof \
    && chown -R node:node /home/node

COPY docs_server.py /home/node/.openclaw/docs_server.py
COPY startup.sh /home/node/.openclaw/startup.sh
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /home/node/.openclaw/startup.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
