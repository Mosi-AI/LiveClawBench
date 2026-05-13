FROM liveclawbench-flight-seat-selection-failed-base:latest

# Copy environment apps
COPY . /workspace/environment/

# Install airline-app backend dependencies
RUN cd /workspace/environment/airline-app/backend && pip install --break-system-packages -r requirements.txt

# Install airline-app frontend dependencies
RUN cd /workspace/environment/airline-app/frontend && npm install --include=dev 2>&1 | tee /tmp/airline-npm-install.log

# Inject pre-defined data
RUN cd /workspace/environment/airline-app/backend && python3 scripts/inject_data.py

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

CMD ["sh", "-c", "sleep infinity"]
