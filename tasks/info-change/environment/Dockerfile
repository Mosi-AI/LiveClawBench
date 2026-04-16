FROM liveclawbench-info-change-base:latest

COPY . /workspace/environment/

# Install shop-app dependencies
RUN cd /workspace/environment/shop-app/backend && pip install --no-cache-dir --break-system-packages --timeout 120 --retries 5 -r requirements.txt

CMD ["sh", "-c", "sleep infinity"]
