FROM ghcr.io/openclaw/openclaw:2026.3.11

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

USER root

# Pre-fix apt sources to HTTPS: proxy at port 7897 supports HTTPS CONNECT tunneling
# but not plain HTTP forwarding. The default Debian 12 (bookworm) DEB822 sources
# use http://deb.debian.org which returns 502 through the proxy. This must run
# BEFORE any apt-get calls, especially `playwright install --with-deps`.
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' \
        /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv curl && \
    rm -rf /var/lib/apt/lists/*

# Install Playwright Chromium with all system dependencies.
# openclaw's findChromeExecutableLinux() only checks system paths like /usr/bin/chromium —
# it does not scan the Playwright cache directory. The symlink bridges this gap.
# --with-deps works because apt sources are already HTTPS-fixed above.
# chmod ensures the Playwright cache is world-readable/executable so that tasks
# running as USER node (Pattern 4) can launch the browser without permission errors.
RUN PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright \
    node /app/node_modules/playwright-core/cli.js install --with-deps chromium && \
    CHROME_PATH=$(find /root/.cache/ms-playwright -name 'chrome' -type f | head -1) && \
    ln -sf "$CHROME_PATH" /usr/bin/chromium && \
    chmod -R a+rX /root/.cache/ms-playwright/

WORKDIR /workspace
RUN mkdir -p /workspace/output
