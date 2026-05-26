FROM liveclawbench-newsletter-digest-forward-base:latest

# Copy environment apps
COPY . /workspace/environment/

# Empty notes/ directory — the agent must author newsletter-digest.md there.
RUN mkdir -p /workspace/notes

RUN mkdir -p /workspace/output

CMD ["sh", "-c", "sleep infinity"]
