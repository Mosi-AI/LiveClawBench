FROM liveclawbench-base:latest

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    git && \
    rm -rf /var/lib/apt/lists/*

# Copy environment data (includes patches/ inside the build context)
COPY . /workspace/environment/

# Symlink so /workspace/patches works for both entrypoint and test.sh
RUN ln -s /workspace/environment/patches /workspace/patches

# Apply bottom-level patches at build time so the agent sees updated skills
RUN bash /workspace/patches/apply_patches.sh
