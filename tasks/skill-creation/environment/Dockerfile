FROM liveclawbench-base:latest

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    git && \
    rm -rf /var/lib/apt/lists/*

# Copy environment data and scripts
COPY . /workspace/environment/

# Inject SOUL.md into OpenClaw workspace so it becomes part of the system prompt
RUN mkdir -p /root/.openclaw/workspace && \
    cp /workspace/environment/SOUL.md /root/.openclaw/workspace/SOUL.md

# Pre-create output directory for skill creation
RUN mkdir -p /workspace/output
