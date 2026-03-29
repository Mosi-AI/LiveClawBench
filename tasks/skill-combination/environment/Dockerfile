FROM liveclawbench-base:latest

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

USER root

# Copy environment data (skills, data, SOUL.md)
COPY . /workspace/environment/

# Make SOUL.md discoverable by openclaw at the workspace root
RUN ln -s /workspace/environment/SOUL.md /workspace/SOUL.md

# Create output directories
RUN mkdir -p /workspace/environment/output /workspace/model_response
