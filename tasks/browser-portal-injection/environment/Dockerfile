ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

ENV HOME=/home/node \
    OPENCLAW_ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3 \
    OPENCLAW_ARK_MODEL=kimi-k2.5
WORKDIR /home/node/.openclaw

USER root
RUN mkdir -p /home/node/.openclaw/output /home/node/.openclaw/workspace/memory /home/node/.openclaw/tools \
    && chown -R node:node /home/node

COPY browser_mock_sidecar/ /home/node/.openclaw/browser_mock_sidecar/
COPY corpus/ /home/node/.openclaw/corpus/
COPY tools/ /home/node/.openclaw/tools/
COPY workspace_seed/ /home/node/.openclaw/workspace/
COPY startup.sh /home/node/.openclaw/startup.sh
COPY entrypoint.sh /entrypoint.sh
RUN ln -sfn ../corpus /home/node/.openclaw/workspace/corpus \
    && ln -sfn ../tools /home/node/.openclaw/workspace/tools \
    && chmod +x /home/node/.openclaw/startup.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
