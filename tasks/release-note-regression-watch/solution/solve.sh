#!/usr/bin/env bash
# Reference solution for release-note-regression-watch.
# Reads both release-note pages and updates regression_watch.md accordingly.
set -euo pipefail

WATCHLIST="/home/node/.openclaw/workspace/regression_watch.md"

python3 - "${WATCHLIST}" <<'PY'
import sys
from pathlib import Path

watchlist_path = Path(sys.argv[1])

# Updated regression watchlist reflecting v2.0.0 changes:
#   - "Export Reports"          -> renamed to "Export Bundles"
#   - "Legacy CSV Import"       -> removed (replaced by Universal Import)
#   - "Multi-tenant Workspaces" -> renamed to "Organizations"
#   - "AI Summaries"            -> demoted to Beta
#   - "Weekly Digest Emails"    -> removed (replaced by Notification Center)
updated = """\
# Regression Watch

Last updated: 2026-04-10

## Tracked Features

| Feature | Status | Notes |
|---------|--------|-------|
| Export Bundles | Supported | Verify ZIP bundle downloads include CSV, Excel, and PDF correctly (renamed from Export Reports in v2.0.0) |
| Organizations | Supported | Confirm team isolation and role management under Organizations model (renamed from Multi-tenant Workspaces in v2.0.0) |
| AI Summaries | Beta | Verify Beta Program access gate; test with documents longer than 50 pages (demoted to Beta in v2.0.0) |
| Custom Dashboards | Supported | Build custom analytics dashboards from project metrics |
| Audit Logs | Supported | Full audit trail for all workspace actions |
"""

watchlist_path.write_text(updated, encoding="utf-8")
print(f"Updated regression watchlist at {watchlist_path}")
PY
