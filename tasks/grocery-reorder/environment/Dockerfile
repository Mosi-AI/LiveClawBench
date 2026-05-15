FROM liveclawbench-grocery-reorder-base:latest

# Task-specific environment setup (if any)
# The base image already contains:
# - smarthome mock binary on port 5004
# - shop mock binary on port 1234
# - seed.sql copied to /opt/mock/data/smarthome.sql
# - products.json copied to /opt/mock/static/shop/products.json
# - startup.sh embedded in /opt/mock/startup.d/grocery-reorder.sh

# Copy task-specific files to overlay directory
# This allows task directory changes (seed.sql, startup.sh, etc.) to take effect
# without rebuilding the base image
COPY seed.sql /opt/mock/data/smarthome.sql
COPY startup.sh /opt/mock/startup-overrides/grocery-reorder.sh
COPY products.json /opt/mock/static/shop/products.json

CMD ["sh", "-c", "sleep infinity"]
