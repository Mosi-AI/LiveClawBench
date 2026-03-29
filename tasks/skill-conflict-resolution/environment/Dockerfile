FROM liveclawbench-base:latest

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    git && \
    rm -rf /var/lib/apt/lists/*

# Copy environment data and scripts
COPY . /workspace/environment/

# Preserve original SKILL.md as baseline for evaluation
# (agent may modify the in-place copy during execution)
RUN cp /workspace/environment/interaction_pattern_analyzer/SKILL.md \
       /workspace/environment/interaction_pattern_analyzer/SKILL.md.baseline
