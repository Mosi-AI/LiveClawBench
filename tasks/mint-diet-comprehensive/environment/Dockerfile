FROM liveclawbench-mint-diet-comprehensive-base:latest

# The per-task base image provides /opt/mock/entrypoint.sh and the Mint Diet startup script.
HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

USER root

RUN mkdir -p /workspace/output
