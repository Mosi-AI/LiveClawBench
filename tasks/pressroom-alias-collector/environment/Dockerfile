FROM liveclawbench-pressroom-alias-collector-base:latest
COPY workspace_seed/ /home/node/.openclaw/workspace/
COPY . /workspace/environment/
RUN chmod +x /workspace/environment/startup.sh /workspace/environment/entrypoint.sh
RUN pip3 install pandas --break-system-packages
ENTRYPOINT ["/workspace/environment/entrypoint.sh"]
