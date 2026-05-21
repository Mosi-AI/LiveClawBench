# orderstream-api — production image
#
# !! POLICY VIOLATION: this Dockerfile currently drifts from POLICY.md in two
# !! ways. See POLICY.md § "Dockerfile rules".
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt ./
# !! bypasses constraints.txt — violates POLICY.md rule 1
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
ENV PYTHONPATH=/app/src

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "webapp.main:app", "--host", "0.0.0.0", "--port", "8000"]
