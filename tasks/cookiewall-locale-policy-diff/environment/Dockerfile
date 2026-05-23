FROM liveclawbench-cookiewall-locale-policy-diff-base:latest
COPY . /workspace/environment/
RUN chmod +x /workspace/environment/startup.sh /workspace/environment/entrypoint.sh
ENTRYPOINT ["/workspace/environment/entrypoint.sh"]
