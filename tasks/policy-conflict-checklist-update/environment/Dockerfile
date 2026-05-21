ARG OPENCLAW_BASE_IMAGE=liveclawbench-policy-conflict-checklist-update-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

ENV HOME=/home/node \
    OPENCLAW_ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3 \
    OPENCLAW_ARK_MODEL=kimi-k2.5
WORKDIR /home/node/.openclaw

USER root
RUN mkdir -p /home/node/.openclaw/output /workspace \
    && chown -R node:node /home/node /workspace

COPY corpus/ /home/node/.openclaw/corpus/
COPY compliance_checklist.md /workspace/compliance_checklist.md
RUN chmod 666 /workspace/compliance_checklist.md
