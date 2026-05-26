FROM liveclawbench-stale-client-escalation-base:latest

# Copy environment apps (notes/ are copied to /workspace/notes/ where the
# verifier expects them).
COPY . /workspace/environment/

# Stage the seed escalation log where the agent and verifier expect it
RUN mkdir -p /workspace/notes \
    && cp /workspace/environment/notes/client-escalation-log.md /workspace/notes/client-escalation-log.md

RUN mkdir -p /workspace/output

CMD ["sh", "-c", "sleep infinity"]
