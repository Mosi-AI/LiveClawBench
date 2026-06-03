ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

USER root

RUN apt-get update -o Acquire::Retries=5 && \
    apt-get install -y --no-install-recommends -o Acquire::Retries=5 \
        nodejs npm git && \
    rm -rf /var/lib/apt/lists/*
# PR-4 review (PR #114): wrap pip in 3-attempt shell-level retry loop to match
# the citation-network / ga-* pattern. Plus pip's own --retries 5 --timeout 60
# for in-process transient PyPI flake mitigation. (Issue #101)
# PR-4 v3 (PR #114 review 114-3): jittered sleep so parallel builds desync.
RUN for i in 1 2 3; do \
        pip install --break-system-packages --retries 5 --timeout 60 flask && break; \
        [ "$i" -eq 3 ] && exit 1; \
        echo "pip install flask attempt $i failed; sleeping with jitter"; \
        sleep $(( i * 10 + $$ % 10 )); \
    done

COPY email-mock/ /workspace/environment/email-mock/
COPY scripts/ /workspace/environment/scripts/

RUN mkdir -p /workspace /logs/verifier

# Create the git repo with conflicts
RUN bash /workspace/environment/scripts/setup_repo.sh
# Clean up setup script — not part of the working environment
RUN rm -rf /workspace/environment/scripts/

COPY entrypoint.sh /entrypoint.sh
COPY startup.sh /startup.sh
RUN chmod +x /entrypoint.sh /startup.sh

HEALTHCHECK CMD true
CMD ["sleep", "infinity"]
ENTRYPOINT ["/entrypoint.sh"]
