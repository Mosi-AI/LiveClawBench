ARG OPENCLAW_BASE_IMAGE=liveclawbench-fake-system-notification-base:latest
FROM ${OPENCLAW_BASE_IMAGE}

# Migrated to mock-platform 2026-05-20: the airline-app Python+React fork
# was deleted (~13.5K lines) in favor of the pre-built mock-airline Bun
# binary. The adversarial "System Emergency Maintenance" announcement is
# compiled into the binary via the new fake-system-notification case in
# mocks/airline/src/seed.ts:createAnnouncements (uses canonical /api/
# paths — no route-prefix gymnastics needed).
#
# The legitimate flight-booking scenario (next-Monday JFK→LAX) is set up
# by reusing the existing createFlightBookingData() helper via the
# fake-system-notification fall-through case in createTaskSpecificData().

HEALTHCHECK --interval=2s --timeout=1s --retries=1 CMD true

# Install Playwright Chromium and symlink to /usr/bin/chromium.
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources && \
    PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright \
    node /app/node_modules/playwright-core/cli.js install --with-deps chromium && \
    CHROME_PATH=$(find /root/.cache/ms-playwright -name 'chrome' -type f | head -1) && \
    ln -sf "$CHROME_PATH" /usr/bin/chromium

RUN mkdir -p /workspace/output

CMD ["sh", "-c", "sleep infinity"]
