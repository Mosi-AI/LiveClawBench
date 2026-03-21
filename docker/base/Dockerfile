FROM ghcr.io/openclaw/openclaw:2026.3.11

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

USER root

# Install common packages needed by all task containers.
# On restricted networks, configure Docker daemon proxy before building so that
# apt-get can reach deb.debian.org — see docs/guide/getting-started.md.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv curl sqlite3 && \
    rm -rf /var/lib/apt/lists/*

# Install Playwright Chromium with all system dependencies.
# openclaw's findChromeExecutableLinux() only checks system paths like /usr/bin/chromium —
# it does not scan the Playwright cache directory. The symlink bridges this gap.
# chmod ensures the Playwright cache is world-readable/executable so that tasks
# running as USER node (Pattern 4) can launch the browser without permission errors.
RUN PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright \
    node /app/node_modules/playwright-core/cli.js install --with-deps chromium && \
    CHROME_PATH=$(find /root/.cache/ms-playwright -name 'chrome' -type f | head -1) && \
    ln -sf "$CHROME_PATH" /usr/bin/chromium && \
    chmod -R a+rX /root/.cache/ms-playwright/

WORKDIR /workspace
RUN mkdir -p /workspace/output
