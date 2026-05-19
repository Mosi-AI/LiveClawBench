FROM liveclawbench-nutrition-log-meal-base:latest

# The per-task base image provides /opt/mock/entrypoint.sh and the Mint Diet startup script.
ENV TZ=UTC

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

USER root

RUN mkdir -p /workspace/output
