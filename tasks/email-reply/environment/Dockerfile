FROM liveclawbench-base:latest

# Copy environment apps
COPY . /workspace/environment/

# Install email-app backend dependencies
RUN cd /workspace/environment/email-app/backend && pip install --break-system-packages -r requirements.txt

# Install email-app frontend dependencies
RUN cd /workspace/environment/email-app/frontend && npm install

# Inject initial data for email-reply
RUN cd /workspace/environment/email-app/backend && python3 scripts/inject_data.py

# Copy startup script
COPY startup.sh /workspace/startup.sh
RUN chmod +x /workspace/startup.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "sleep infinity"]
