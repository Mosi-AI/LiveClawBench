#!/usr/bin/env bash
# Setup the webapp Git repository with main and dev branches.
# This runs during Docker build to prepare the task environment.
set -euo pipefail

WEBAPP_DIR="/workspace/webapp"
mkdir -p "$WEBAPP_DIR"
cd "$WEBAPP_DIR"

git init
git config user.email "bob.martinez@company.local"
git config user.name "Bob Martinez"
git branch -m main

# ---- main branch content ----
cat > index.html << 'MAINEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Company Web App</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f0f8ff; }
        h1 { color: #2c3e50; }
        .build-id { color: #888; font-family: monospace; }
        .env-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; background: #27ae60; color: white; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Company Web App</h1>
    <span class="env-badge">Production</span>
    <p>Welcome to the production environment.</p>
    <p class="build-id">Build ID: PROD-CD-2026-A7X9K2</p>
</body>
</html>
MAINEOF

cat > README.md << 'EOF'
# Company Web App

A simple static website deployed via Git push.

## Branches
- `main` — Production release
- `dev` — Development / staging
EOF

git add -A
git commit -m "Initial commit: production release"

# ---- dev branch content ----
git checkout -b dev

cat > index.html << 'DEVEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Company Web App - Dev</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #fff8e1; }
        h1 { color: #2c3e50; }
        .build-id { color: #888; font-family: monospace; }
        .env-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; background: #e67e22; color: white; font-weight: bold; }
    </style>
</head>
<body>
    <h1>Company Web App</h1>
    <span class="env-badge">Development</span>
    <p>Welcome to the development environment.</p>
    <p class="build-id">Build ID: DEV-CD-2026-M3P5W8</p>
    <p><em>New feature: user dashboard (in progress)</em></p>
</body>
</html>
DEVEOF

git add -A
git commit -m "Dev branch: add development banner and WIP feature"

# Switch back to main
git checkout main

echo "Webapp repo initialized at $WEBAPP_DIR with main and dev branches."
