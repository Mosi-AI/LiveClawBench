#!/usr/bin/env bash
# Start script for the PyPI server.
# Configuration is read from config.ini.

set -e

CONFIG="/workspace/pypi-server/config.ini"

# Parse config (simple grep-based, not robust)
PORT=$(grep "^port" "$CONFIG" | cut -d'=' -f2 | tr -d ' "')
HOST=$(grep "^host" "$CONFIG" | cut -d'=' -f2 | tr -d ' "')
HTPASSWD=$(grep "^htpasswd" "$CONFIG" | cut -d'=' -f2 | tr -d ' "')
PACKAGES=$(grep "^packages_dir" "$CONFIG" | cut -d'=' -f2 | tr -d ' "')

echo "Starting PyPI server..."
echo "  Host: $HOST"
echo "  Port: $PORT"
echo "  Auth: $HTPASSWD"
echo "  Packages: $PACKAGES"

# Start pypiserver
exec pypi-server run \
    -p "$PORT" \
    -i "$HOST" \
    -P "$HTPASSWD" \
    "$PACKAGES"
