FROM liveclawbench-finance-tax-prepare-base:latest

ENV MOCK_FINANCE_DB_PATH=/opt/mock/data/finance_app.sqlite
ENV MOCK_FINANCE_SEED_SQL=/workspace/environment/seed.sql

COPY . /workspace/environment/
COPY policies/ /workspace/policies/

CMD ["sh", "-c", "sleep infinity"]
