#!/usr/bin/env bash
# setup.sh — LiveClawBench environment setup
# Run from the LiveClawBench/ directory.
set -euo pipefail

HARBOR_REPO_URL="https://github.com/Mosi-AI/claw-harbor.git"
HARBOR_VERSION="v0.1.0"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"

echo "==> LiveClawBench Setup"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Prerequisite checks
# ---------------------------------------------------------------------------
echo "[1/5] Checking prerequisites..."

check_cmd() {
    local cmd="$1"
    local install_hint="$2"
    if ! command -v "$cmd" &>/dev/null; then
        echo "  ERROR: '$cmd' not found."
        echo "         $install_hint"
        exit 1
    fi
    echo "  OK  $cmd ($(command -v "$cmd"))"
}

check_cmd git    "Install from https://git-scm.com/downloads"
check_cmd uv     "Install from https://docs.astral.sh/uv/getting-started/installation/"
check_cmd docker "Install from https://docs.docker.com/get-docker/"
check_cmd bun    "Install from https://bun.sh"
check_cmd node   "Install from https://nodejs.org (>= 18 required for frontend builds)"
check_cmd npm    "Included with Node.js (>= 18)"

# Python >= 3.12 check (uv manages Python, but verify host has one accessible)
PY_VERSION=$(python3 --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
PY_MAJOR=$(echo "$PY_VERSION" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VERSION" | cut -d. -f2)
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 12 ]; }; then
    echo "  ERROR: Python >= 3.12 required (found $PY_VERSION)."
    echo "         Install via uv: uv python install 3.12"
    exit 1
fi
echo "  OK  python3 ($PY_VERSION)"

# Node.js >= 18 check (required for frontend SPA builds)
NODE_VERSION=$(node --version 2>&1 | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "  ERROR: Node.js >= 18 required (found v$NODE_VERSION)."
    echo "         Install from https://nodejs.org"
    exit 1
fi
echo "  OK  node (v$NODE_VERSION)"

echo ""

# ---------------------------------------------------------------------------
# Step 2: Harbor installation into local .venv (idempotent)
# ---------------------------------------------------------------------------
echo "[2/5] Setting up Harbor framework..."

if [ ! -d "$VENV_DIR" ]; then
    echo "  Creating virtual environment at .venv ..."
    uv venv "$VENV_DIR" --quiet
else
    echo "  Virtual environment .venv already exists — skipping creation."
fi

echo "  Installing harbor CLI from $HARBOR_REPO_URL @ $HARBOR_VERSION ..."
uv pip install --quiet --python "$VENV_DIR/bin/python" "harbor @ git+${HARBOR_REPO_URL}@${HARBOR_VERSION}"

HARBOR_BIN="$VENV_DIR/bin/harbor"
if [ ! -f "$HARBOR_BIN" ]; then
    echo "  ERROR: harbor binary not found at $HARBOR_BIN after install."
    echo "         Please check your network connection and retry."
    exit 1
fi
echo "  harbor CLI: $("$HARBOR_BIN" --version 2>&1 | head -1)"

echo ""

# ---------------------------------------------------------------------------
# Step 3: Build the shared base Docker image
# ---------------------------------------------------------------------------
echo "[3/5] Building liveclawbench-base Docker image..."
echo "  This is required before running any task (image is local-only, not in a registry)."
docker build -t liveclawbench-base:latest "$SCRIPT_DIR/docker/base/"
echo "  liveclawbench-base:latest built successfully."

echo ""

# ---------------------------------------------------------------------------
# Step 4: Build Bun mock binaries and per-task Docker images
# ---------------------------------------------------------------------------
echo "[4/5] Building Bun mock binaries and per-task Docker images..."

# Build binaries
cd "$SCRIPT_DIR/mock-platform"
bun install --silent
bun run build

# Build per-task images (dry-run to validate schema, then build images)
bun run build:images
cd "$SCRIPT_DIR"

echo "  Mock binaries and per-task images built successfully."

echo ""

# ---------------------------------------------------------------------------
# Step 5: .env setup
# ---------------------------------------------------------------------------
echo "[5/5] Configuring .env..."

if [ ! -f "$SCRIPT_DIR/.env" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo "  Created .env from .env.example"
    echo ""
    echo "  *** ACTION REQUIRED: edit .env and fill in your API credentials. ***"
    echo ""
    echo "  Template preview:"
    echo "  -----------------------------------------------------------------"
    grep -v '^#' "$SCRIPT_DIR/.env.example" | grep -v '^$' | head -20 || true
    echo "  -----------------------------------------------------------------"
else
    echo "  .env already exists — no changes made."
    echo "  Tip: run 'diff .env .env.example' to check for new required variables."
fi

echo ""
echo "================================================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "    1. Edit .env with your API credentials"
echo "    2. Activate the virtual environment:"
echo "       source .venv/bin/activate"
echo "    3. Run your first task:"
echo "       harbor run -p tasks/watch-shop -a openclaw \\"
echo "         -m volcengine-plan/kimi-k2.5 -n 1 -o jobs \\"
echo "         --ae VOLCANO_ENGINE_API_KEY=\"\$VOLCANO_ENGINE_API_KEY\""
echo ""
echo "  Or run harbor directly without activating the venv:"
echo "       .venv/bin/harbor run -p tasks/watch-shop ..."
echo "================================================================"
