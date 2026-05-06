FROM liveclawbench-email-washer-change-base:latest

COPY . /workspace/environment/

# Install email-app dependencies
RUN cd /workspace/environment/email-app/backend && pip install --no-cache-dir --break-system-packages -r requirements.txt
RUN cd /workspace/environment/email-app/frontend && npm install

CMD ["sh", "-c", "sleep infinity"]
