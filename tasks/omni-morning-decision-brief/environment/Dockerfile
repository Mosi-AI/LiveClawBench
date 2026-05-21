ARG OPENCLAW_BASE_IMAGE=liveclawbench-omni-morning-decision-brief-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

ENV HOME=/home/node \
    OPENCLAW_ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3 \
    OPENCLAW_ARK_MODEL=kimi-k2.5
WORKDIR /home/node/.openclaw

USER root
RUN mkdir -p /home/node/.openclaw/output /workspace \
    && chown -R node:node /home/node /workspace

COPY daily_action_log.md /workspace/daily_action_log.md
RUN chmod 666 /workspace/daily_action_log.md
