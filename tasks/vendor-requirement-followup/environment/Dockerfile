FROM liveclawbench-vendor-requirement-followup-base:latest

# Copy environment apps (notes/ are copied to /workspace/notes/ where the
# verifier expects them).
COPY . /workspace/environment/

# Stage the seed tracker note where the agent and verifier expect it
RUN mkdir -p /workspace/notes \
    && cp /workspace/environment/notes/requirements-tracker.md /workspace/notes/requirements-tracker.md

RUN mkdir -p /workspace/output

CMD ["sh", "-c", "sleep infinity"]
