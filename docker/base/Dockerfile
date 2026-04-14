FROM ghcr.io/openclaw/openclaw:2026.3.11

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

USER root

# Install common packages needed by all task containers.
# On restricted networks, configure Docker daemon proxy before building so that
# apt-get can reach deb.debian.org — see docs/guide/getting-started.md.
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv curl sqlite3 unzip && \
    rm -rf /var/lib/apt/lists/*

# Install Bun runtime for mock platform binaries
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.11" && \
    ln -s /root/.bun/bin/bun /usr/local/bin/bun

# Create mock user and directory structure
# Mock binaries live in /opt/mock/bin/ (populated by per-task images)
# Startup scripts live in /opt/mock/startup.d/ (read-only, root:root)
#
# SECURITY NOTE: The root:root + mode 755 hardening is only effective when
# the agent runs as a non-root user (e.g., user:mock). In Plan 1, the agent
# still runs as root for backward compatibility with existing task Dockerfiles,
# so this boundary is not yet enforced. Plan 2 will switch to non-root execution.
RUN groupadd -r mock && useradd -r -g mock -d /opt/mock -s /sbin/nologin mock && \
    mkdir -p /opt/mock/bin /opt/mock/startup.d /opt/mock/data && \
    chown root:root /opt/mock/startup.d && \
    chmod 755 /opt/mock/startup.d

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
