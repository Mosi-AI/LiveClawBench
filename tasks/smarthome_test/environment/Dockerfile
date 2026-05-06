FROM liveclawbench-smarthome_test-base:latest

COPY . /workspace/environment/

# fastapi-required: Install smarthome-app dependencies (disabled when using Bun mock)
# RUN cd /workspace/environment/smarthome-app/backend && pip install --no-cache-dir --break-system-packages -r requirements.txt

CMD ["sh", "-c", "sleep infinity"]
