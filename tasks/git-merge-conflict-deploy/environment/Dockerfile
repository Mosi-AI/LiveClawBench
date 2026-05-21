ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

USER root

RUN apt-get update && apt-get install -y --no-install-recommends nodejs npm git && rm -rf /var/lib/apt/lists/*
RUN pip install --break-system-packages flask

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
