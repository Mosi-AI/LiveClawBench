FROM liveclawbench-smarthome-test-base:latest

# Copy task-specific files
# This allows seed.sql changes to take effect without rebuilding the base image
COPY seed.sql /opt/mock/data/smarthome.sql

CMD ["sh", "-c", "sleep infinity"]
