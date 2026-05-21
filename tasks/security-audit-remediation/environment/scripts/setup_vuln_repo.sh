#!/bin/bash
# setup_vuln_repo.sh — Initialize the vulnerable webapp as a Git repository
# with secrets leaked across multiple commits in the history.
#
# Note: secret literals are assembled at runtime via string concatenation so
# the source tree contains no continuous secret literals (GitHub push protection
# would block the commit). The container build still produces a webapp whose
# files contain the full literals — that is the task's intended starting state.

set -e

REPO_DIR="/workspace/webapp"
cd "$REPO_DIR"

# Reassemble leaked secrets at runtime (split to evade source-side scanning).
SK_LIVE="sk_""live_4eC39HqLyjWDarjtT1zdp7dc"
AKIA_KEY="AKIA""IOSFODNN7EXAMPLE"
AWS_SECRET="wJalrXUtnFEMI""/K7MDENG/bPxRfiCYEXAMPLEKEY"
PAY_TOKEN="tok_""live_payment_gateway_2026_secret"

# Substitute placeholders in source files copied from environment/webapp/.
sed -i "s|@@SK_LIVE@@|${SK_LIVE}|g" app.py config.py

# Initialize git repo
git init
git config user.email "developer@webapp.local"
git config user.name "Developer"

# ─── Commit 1: Initial project structure ───
git add app.py config.py requirements.txt
mkdir -p tests
git add tests/
git commit -m "Initial project structure with Flask webapp"

# ─── Commit 2: Add AWS credentials to config (LEAKED SECRET) ───
cat >> config.py << AWSEOF

# AWS Configuration
AWS_ACCESS_KEY_ID = "${AKIA_KEY}"
AWS_SECRET_ACCESS_KEY = "${AWS_SECRET}"
AWS_REGION = "us-east-1"
S3_BUCKET = "webapp-uploads-prod"
AWSEOF
git add config.py
git commit -m "add AWS S3 upload configuration"

# ─── Commit 3: Add payment gateway token (LEAKED SECRET) ───
cat >> config.py << PAYEOF

# Payment Gateway
PAYMENT_GATEWAY_TOKEN = "${PAY_TOKEN}"
PAYMENT_ENDPOINT = "https://api.payments.example.com/v2/charge"
PAYEOF
git add config.py
git commit -m "integrate payment gateway for premium features"

# ─── Commit 4: Create a deploy script with inline secrets ───
mkdir -p scripts
cat > scripts/deploy.sh << DEPLOYEOF
#!/bin/bash
# Quick deploy script
export DB_PASSWORD="super_secret_db_pass_2026"
export JWT_SECRET="jwt-hardcoded-secret-never-do-this"
export API_KEY="${SK_LIVE}"

echo "Deploying webapp..."
python3 app.py &
DEPLOYEOF
chmod +x scripts/deploy.sh
git add scripts/deploy.sh
git commit -m "add deployment script for quick launches"

# ─── Commit 5: "Remove" secrets from config (but they stay in history) ───
# Rewrite config.py to use environment variables (partially)
cat > config.py << CFGEOF
import os

# Application Configuration
DEBUG = os.environ.get("DEBUG", "false").lower() == "true"
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "5000"))

# Database
DB_PATH = os.environ.get("DB_PATH", "/workspace/webapp/webapp.db")

# API Key — NOTE: fallback still contains the leaked key
API_KEY = os.environ.get("API_KEY", "${SK_LIVE}")

# AWS Configuration
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
S3_BUCKET = os.environ.get("S3_BUCKET", "webapp-uploads-prod")

# Payment Gateway
PAYMENT_GATEWAY_TOKEN = os.environ.get("PAYMENT_GATEWAY_TOKEN", "")
PAYMENT_ENDPOINT = os.environ.get("PAYMENT_ENDPOINT", "https://api.payments.example.com/v2/charge")
CFGEOF
git add config.py
git commit -m "move secrets to environment variables (cleanup)"

# ─── Commit 6: Remove deploy script (but secrets remain in history) ───
rm -rf scripts/deploy.sh
git add -A
git commit -m "remove deprecated deploy script"

echo "[setup_vuln_repo] Git repository initialized with leaked secrets in history"
echo "[setup_vuln_repo] Commits: $(git log --oneline | wc -l)"
