FROM liveclawbench-smart-home-sleep-quality-base:latest

# Task-specific environment setup
# The base image already contains:
# - smarthome mock binary on port 5004
# - health mock binary on port 5007
# - shop mock binary on port 1234
# - seed.sql copied to /opt/mock/data/smarthome.sql
# - health-seed.sql copied to /opt/mock/data/health.sql
# - products.json copied to /opt/mock/static/shop/products.json
# - startup.sh embedded in /opt/mock/startup.d/smart-home-sleep-quality.sh

# Copy task-specific files to overlay directory
COPY seed.sql /opt/mock/data/smarthome.sql
COPY health-seed.sql /opt/mock/data/health.sql
COPY startup.sh /opt/mock/startup-overrides/smart-home-sleep-quality.sh
COPY products.json /opt/mock/static/shop/products.json

CMD ["sh", "-c", "sleep infinity"]