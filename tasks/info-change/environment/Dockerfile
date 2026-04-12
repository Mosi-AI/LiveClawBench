FROM liveclawbench-info-change:latest

COPY . /workspace/environment/

# Install shop-app dependencies
RUN cd /workspace/environment/shop-app/backend && pip install --no-cache-dir --break-system-packages -r requirements.txt

CMD ["sh", "-c", "sleep infinity"]
