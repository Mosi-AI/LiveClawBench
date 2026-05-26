FROM liveclawbench-finance-budget-shift-base:latest

ENV MOCK_FINANCE_DB_PATH=/opt/mock/data/finance_app.sqlite
ENV MOCK_FINANCE_SEED_SQL=/workspace/environment/seed.sql

COPY . /workspace/environment/

CMD ["sh", "-c", "sleep infinity"]
