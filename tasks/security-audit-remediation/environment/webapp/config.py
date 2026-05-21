"""
Application configuration.

NOTE: This file previously contained hardcoded secrets.
They were 'removed' but remain in Git history.
Current values should be loaded from environment variables.
"""

import os

# These SHOULD use os.environ.get() but one still has a hardcoded fallback
API_KEY = os.environ.get(
    "API_KEY", "@@SK_LIVE@@"
)  # placeholder substituted at build time
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
JWT_SECRET = os.environ.get("JWT_SECRET", "")
AWS_ACCESS_KEY_ID = os.environ.get("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.environ.get("AWS_SECRET_ACCESS_KEY", "")
PAYMENT_GATEWAY_TOKEN = os.environ.get("PAYMENT_GATEWAY_TOKEN", "")
