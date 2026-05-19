FROM liveclawbench-autonomous-weapons-ethics-base:latest

ENV HOME=/home/node
WORKDIR /home/node/.openclaw

USER root
RUN mkdir -p /home/node/.openclaw/output /home/node/.openclaw/workspace \
    && chown -R node:node /home/node

COPY . /workspace/environment/

CMD ["sh", "-c", "sleep infinity"]
