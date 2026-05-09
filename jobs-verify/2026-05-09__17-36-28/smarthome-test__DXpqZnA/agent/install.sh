#!/bin/bash
set -euo pipefail

# Check for pre-installed openclaw.mjs (official Docker image layout: node:24-bookworm base)
# Must check this BEFORE `which openclaw` because the image may ship openclaw.mjs without
# a wrapper in PATH. We create the wrapper here so subsequent PATH checks also work.
if [ -f /app/openclaw.mjs ] && ! command -v openclaw &> /dev/null; then
    echo "Found /app/openclaw.mjs, creating wrapper at /usr/local/bin/openclaw"
    # Use tee to write the wrapper — avoids echo quoting issues and works without root
    # if /usr/local/bin is writable (it is in official openclaw images running as root).
    printf '#!/bin/sh\nexec node /app/openclaw.mjs "$@"\n' | tee /usr/local/bin/openclaw > /dev/null
    chmod +x /usr/local/bin/openclaw
fi

# Check if openclaw is now (or was already) in PATH; if not, install it.
if command -v openclaw &> /dev/null; then
    echo "openclaw found in PATH, skipping installation"
    openclaw --version
else
    # Ensure Node.js >= 22 is available
    NODE_MAJOR=0
    if command -v node &> /dev/null; then
        NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
    fi

    if [ "$NODE_MAJOR" -lt 22 ]; then
        echo "Node.js >= 22 required (found: $NODE_MAJOR), installing Node.js 22 LTS..."
        if command -v apk &> /dev/null; then
            apk add --no-cache nodejs npm
            NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
            if [ "$NODE_MAJOR" -lt 22 ]; then
                echo "Error: Alpine repo provided Node.js $NODE_MAJOR, but >= 22 is required" >&2
                exit 1
            fi
        elif command -v apt-get &> /dev/null; then
            apt-get update -qq
            apt-get install -y curl
            curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
            apt-get install -y nodejs
        elif command -v yum &> /dev/null; then
            yum install -y curl
            curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
            yum install -y nodejs
        else
            echo "Error: No supported package manager found" >&2
            exit 1
        fi
    fi

    # Install openclaw via npm

    npm install -g openclaw


    openclaw --version
fi