ARG OPENCLAW_BASE_IMAGE=liveclawbench-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

USER root

# Python 3.10+ may not be the default on the base; ensure it.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# --- Build-time wheel prefetch ---
# The runtime task forbids internet, so we stage every wheel the agent could
# need (right AND wrong versions) into /opt/wheels/. The runtime pip resolver
# uses --no-index --find-links=/opt/wheels.
RUN mkdir -p /opt/wheels /opt/audit
RUN pip install --break-system-packages --upgrade pip wheel setuptools

# Multiple incompatible versions of the same package (fastapi, pydantic, etc.)
# cannot be resolved by pip in a single `pip download` invocation. Download
# each conflicting pin individually with --no-deps so all variants land in
# /opt/wheels for the runtime resolver to pick from.
RUN for spec in \
        "fastapi==0.95.2" "fastapi==0.89.0" \
        "pydantic==1.10.13" "pydantic==1.10.2" \
        "cryptography==41.0.4" "cryptography==3.4.8" \
        "starlette==0.27.0" "starlette==0.22.0" \
        "anyio==3.7.1" "anyio==3.6.2" ; do \
      pip download --no-cache-dir --no-deps --default-timeout=120 --retries 10 \
          -d /opt/wheels "$spec" ; \
    done

# Remaining single-version dependencies can be downloaded together (resolver-friendly).
RUN pip download --no-cache-dir --default-timeout=120 --retries 10 -d /opt/wheels \
        "httpx==0.24.1" \
        "sniffio==1.3.0" "idna==3.4" "h11==0.14.0" "certifi==2023.7.22" \
        "typing_extensions==4.7.1" "cffi==1.15.1" "pycparser==2.21" \
        "orjson==3.9.10" \
        "pytest==7.4.3" "pytest-asyncio==0.21.1" "pytest-cov==4.1.0" \
        "iniconfig==2.0.0" "packaging==23.2" "pluggy==1.3.0" "coverage==7.3.2" \
        "exceptiongroup==1.1.3" "tomli==2.0.1" \
        "httpcore==0.17.3"

# --- App sources (the "broken" state the agent sees) ---
COPY app/ /workspace/app/

# --- Audit tool ---
COPY audit/ /opt/audit/
RUN chmod +x /opt/audit/pip_audit_mock.py && \
    ln -s /opt/audit/pip_audit_mock.py /usr/local/bin/pip-audit-mock

# --- Working dirs ---
RUN mkdir -p /workspace/output /logs/verifier

# --- Entrypoint ---
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

HEALTHCHECK CMD true
CMD ["sleep", "infinity"]
ENTRYPOINT ["/entrypoint.sh"]
