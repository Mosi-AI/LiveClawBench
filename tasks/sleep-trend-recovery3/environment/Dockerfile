FROM liveclawbench-sleep-trend-recovery3-base:latest

COPY seed.sql /opt/mock/data/smarthome.sql
COPY health-seed.sql /opt/mock/data/health.sql
COPY products.json /opt/mock/static/shop/products.json
COPY shop-orders.json /opt/mock/data/shop-orders.json

CMD ["sh", "-c", "sleep infinity"]
