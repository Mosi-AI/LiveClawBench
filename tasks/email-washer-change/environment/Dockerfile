FROM liveclawbench-base:latest

COPY . /workspace/environment/

# Install shop-app dependencies
RUN cd /workspace/environment/shop-app/backend && pip install --no-cache-dir --break-system-packages -r requirements.txt

# Install email-app dependencies
RUN cd /workspace/environment/email-app/backend && pip install --no-cache-dir --break-system-packages -r requirements.txt
RUN cd /workspace/environment/email-app/frontend && npm install

COPY startup.sh /workspace/environment/startup.sh
RUN chmod +x /workspace/environment/startup.sh

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "sleep infinity"]
