ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

USER root

RUN pip install --break-system-packages flask build twine pypiserver pytest

COPY email-mock/ /workspace/environment/email-mock/
COPY vectorops/ /workspace/vectorops/
COPY pypi-server/ /workspace/pypi-server/

RUN mkdir -p /workspace/pypi-server/packages /workspace/output /logs/verifier

COPY entrypoint.sh /entrypoint.sh
COPY startup.sh /startup.sh
RUN chmod +x /entrypoint.sh /startup.sh

HEALTHCHECK CMD true
CMD ["sleep", "infinity"]
ENTRYPOINT ["/entrypoint.sh"]
