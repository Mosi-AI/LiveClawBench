ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

ENV HOME=/home/node \
    OPENCLAW_ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3 \
    OPENCLAW_ARK_MODEL=kimi-k2.5
WORKDIR /home/node/.openclaw

USER root
RUN mkdir -p /home/node/.openclaw/output /home/node/.openclaw/workspace/memory \
    && chown -R node:node /home/node

COPY corpus/ /home/node/.openclaw/corpus/
COPY workspace_seed/ /home/node/.openclaw/workspace/
RUN ln -sfn ../corpus /home/node/.openclaw/workspace/corpus
