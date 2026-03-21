FROM liveclawbench-base:latest

# Copy environment apps
COPY . /workspace/environment/

# Install airline-app backend dependencies
RUN cd /workspace/environment/airline-app/backend && pip install --break-system-packages -r requirements.txt

# Install airline-app frontend dependencies
RUN cd /workspace/environment/airline-app/frontend && npm install

# Install email-app backend dependencies
RUN cd /workspace/environment/email-app/backend && pip install --break-system-packages -r requirements.txt

# Install email-app frontend dependencies
RUN cd /workspace/environment/email-app/frontend && npm install

# Install todolist-app backend dependencies
RUN cd /workspace/environment/todolist-app/backend && pip install --break-system-packages -r requirements.txt

# Install todolist-app frontend dependencies
RUN cd /workspace/environment/todolist-app/frontend && npm install

# Inject initial data
RUN cd /workspace/environment/email-app/backend && python3 scripts/inject_data.py || true
RUN cd /workspace/environment/todolist-app/backend && python3 init_db.py && python3 inject_data.py && python3 inject_data_manual.py || true

# Copy startup script
COPY startup.sh /workspace/startup.sh
RUN chmod +x /workspace/startup.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "sleep infinity"]
