FROM liveclawbench-long-covid-neurological-hypotheses-base:latest

ENV HOME=/home/node
WORKDIR /home/node/.openclaw

USER root
RUN mkdir -p /home/node/.openclaw/output /home/node/.openclaw/workspace /home/node/.openclaw/research \
    && chown -R node:node /home/node

COPY research/ /home/node/.openclaw/research/
COPY . /workspace/environment/

CMD ["sh", "-c", "sleep infinity"]
