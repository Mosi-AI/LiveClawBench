ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

USER root

RUN pip install --break-system-packages flask

COPY monitoring-mock/ /workspace/environment/monitoring-mock/
COPY scripts/ /workspace/environment/scripts/

RUN mkdir -p /workspace/logs /workspace/output /logs/verifier

# Generate log files during build
RUN python3 /workspace/environment/scripts/generate_logs.py

COPY entrypoint.sh /entrypoint.sh
COPY startup.sh /startup.sh
RUN chmod +x /entrypoint.sh /startup.sh

HEALTHCHECK CMD true
CMD ["sleep", "infinity"]
ENTRYPOINT ["/entrypoint.sh"]
