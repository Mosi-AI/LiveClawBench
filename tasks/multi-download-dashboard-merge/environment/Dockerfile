FROM liveclawbench-multi-download-dashboard-merge-base:latest
COPY . /workspace/environment/
COPY workspace_seed/ /home/node/.openclaw/workspace/
RUN chmod +x /workspace/environment/startup.sh /workspace/environment/entrypoint.sh
ENTRYPOINT ["/workspace/environment/entrypoint.sh"]
