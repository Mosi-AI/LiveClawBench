FROM liveclawbench-base:latest

# Copy environment apps
COPY . /workspace/environment/

# Install airline-app backend dependencies
RUN cd /workspace/environment/airline-app/backend && pip install --break-system-packages -r requirements.txt

# Install airline-app frontend dependencies
RUN cd /workspace/environment/airline-app/frontend && npm install

# Copy startup script
COPY startup.sh /workspace/startup.sh
RUN chmod +x /workspace/startup.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "sleep infinity"]
