FROM liveclawbench-sleep-trend-recovery1-base:latest

COPY seed.sql /opt/mock/data/smarthome.sql
COPY health-seed.sql /opt/mock/data/health.sql
COPY startup.sh /opt/mock/startup-overrides/sleep-trend-recovery1.sh

CMD ["sh", "-c", "sleep infinity"]
