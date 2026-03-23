FROM ghcr.io/openclaw/openclaw:2026.3.11

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copy environment apps
COPY . /workspace/environment/

# Install email-app backend dependencies
RUN cd /workspace/environment/email-app/backend && pip install --break-system-packages -r requirements.txt

# Inject pre-defined data
RUN cd /workspace/environment/email-app/backend && python3 scripts/inject_data.py

# Install email-app frontend dependencies
RUN cd /workspace/environment/email-app/frontend && npm install --include=dev 2>&1 | tee /tmp/npm-install.log

# Copy startup script
COPY startup.sh /workspace/startup.sh
RUN chmod +x /workspace/startup.sh

# Install Playwright Chromium and symlink to /usr/bin/chromium so openclaw's
# findChromeExecutableLinux() can detect it. openclaw only checks system paths
# like /usr/bin/chromium — it does not scan the Playwright cache directory.
# Switch apt sources to HTTPS first: proxy supports HTTPS CONNECT but not plain
# HTTP forwarding, so http://deb.debian.org fails with 502 through the proxy.
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources && \
    PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright \
    node /app/node_modules/playwright-core/cli.js install --with-deps chromium && \
    CHROME_PATH=$(find /root/.cache/ms-playwright -name 'chrome' -type f | head -1) && \
    ln -sf "$CHROME_PATH" /usr/bin/chromium

RUN mkdir -p /workspace/output

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["sh", "-c", "sleep infinity"]
