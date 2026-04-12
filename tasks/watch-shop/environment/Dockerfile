FROM liveclawbench-watch-shop:latest

COPY . /workspace/environment/

# Install shop-app dependencies
RUN cd /workspace/environment/shop-app/backend && pip install --no-cache-dir --break-system-packages -r requirements.txt

COPY startup.sh /workspace/environment/startup.sh
RUN chmod +x /workspace/environment/startup.sh

CMD ["sh", "-c", "sleep infinity"]
