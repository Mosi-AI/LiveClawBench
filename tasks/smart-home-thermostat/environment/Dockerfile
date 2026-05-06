FROM liveclawbench-smart-home-thermostat-base:latest

COPY . /workspace/environment/

# Install smarthome-app dependencies
RUN cd /workspace/environment/smarthome-app/backend && pip install --no-cache-dir --break-system-packages -r requirements.txt

CMD ["sh", "-c", "sleep infinity"]
