#!/usr/bin/env python3
"""Public update portal with release archive. Port 8400."""

import http.server
import json
import re
import urllib.parse

PORT = 8400
HOST = "0.0.0.0"

RELEASES = [
    {
        "version": "v4.3.0",
        "date": "2026-04-15",
        "title": "Data & Privacy Compliance Update",
        "policy_changes": [
            "Updated data retention policy: user data retained for 12 months (reduced from 24 months)",
            "New cookie consent defaults: opt-in required for all analytics and tracking cookies",
        ],
        "other_changes": [
            "Redesigned analytics dashboard with new chart library and export widgets",
            "Added dark mode support across all platform surfaces",
        ],
    },
    {
        "version": "v4.2.0",
        "date": "2026-03-01",
        "title": "API & Export Controls",
        "policy_changes": [
            "API rate limiting policy updated: free tier reduced from 1000 to 500 requests per minute",
            "New data export policy: CSV exports capped at 50 000 rows per request",
        ],
        "other_changes": [
            "Improved search performance by 40% with new indexing engine",
            "New interactive onboarding tutorial for first-time users",
        ],
    },
    {
        "version": "v4.1.0",
        "date": "2026-02-10",
        "title": "Security Hardening Release",
        "policy_changes": [
            "Two-factor authentication policy: now mandatory for all admin and moderator accounts",
            "Password policy updated: minimum 12 characters with mixed case and special characters required",
        ],
        "other_changes": [
            "Mobile app now available on iOS and Android app stores",
            "Fixed intermittent notification delivery delays affecting push alerts",
        ],
    },
    {
        "version": "v4.0.0",
        "date": "2026-01-20",
        "title": "Platform Redesign & Infrastructure Update",
        "policy_changes": [
            "Terms of Service restructured: Section 4.3 (liability limitations) revised with updated jurisdictional clauses",
            "Privacy Shield framework compliance: deprecation notice issued with 90-day transition window",
        ],
        "other_changes": [
            "Complete UI overhaul with new component system and design language",
            "Database migration from MySQL 5.7 to PostgreSQL 15",
        ],
    },
    {
        "version": "v3.9.0",
        "date": "2025-12-05",
        "title": "Performance & Stability",
        "policy_changes": [],
        "other_changes": [
            "Reduced page load time by 60% through lazy loading and code splitting",
            "Fixed 23 reported crashes related to file upload edge cases",
        ],
    },
    {
        "version": "v3.8.0",
        "date": "2025-10-15",
        "title": "Minor Bug Fixes",
        "policy_changes": [],
        "other_changes": [
            "Fixed text overflow in user profile settings panel",
            "Corrected timezone handling for scheduled reports",
        ],
    },
]

INDEX_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Release Archive — Public Update Portal</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
  h1 { font-size: 1.5em; border-bottom: 2px solid #1976d2; padding-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e0e0e0; }
  th { background: #f5f5f5; font-weight: 600; }
  tr:hover { background: #fafafa; }
  a { color: #1976d2; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .version { font-family: monospace; font-weight: 600; }
  .date { color: #666; font-size: 0.9em; }
  .footer { margin-top: 30px; color: #999; font-size: 0.85em; }
</style>
</head>
<body>
<h1>Public Update Portal — Release Archive</h1>
<p>Browse official release notes for all public versions. Each release page includes the full
changelog with policy updates, feature additions, and bug fixes.</p>
<table>
<thead>
<tr><th>Version</th><th>Release Date</th><th>Title</th></tr>
</thead>
<tbody>
{rows}
</tbody>
</table>
<div class="footer">Showing all {total} public releases. For historical releases prior to v3.8.0, contact support.</div>
</body>
</html>"""

DETAIL_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{version} Release Notes — Public Update Portal</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
  h1 { font-size: 1.5em; }
  h2 { font-size: 1.15em; color: #1976d2; margin-top: 24px; border-bottom: 1px solid #e0e0e0; padding-bottom: 6px; }
  .meta { color: #666; font-size: 0.9em; margin-bottom: 20px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 6px; line-height: 1.5; }
  .section { margin-bottom: 20px; }
  .back { margin-top: 30px; }
  .back a { color: #1976d2; }
</style>
</head>
<body>
<h1>{version}: {title}</h1>
<div class="meta">Released: {date}</div>

<div class="section">
<h2>Changes in this Release</h2>
{changes_html}
</div>

<div class="back"><a href="/">Back to Release Archive</a></div>
</body>
</html>"""


def escape_html(s):
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


class PolicyHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": True}).encode())
            return

        if path == "/":
            rows = []
            for r in RELEASES:
                rows.append(
                    f'<tr><td class="version"><a href="/releases/{r["version"]}">{r["version"]}</a></td>'
                    f'<td class="date">{r["date"]}</td>'
                    f"<td>{escape_html(r['title'])}</td></tr>"
                )
            html = INDEX_HTML.format(rows="\n".join(rows), total=len(RELEASES))
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html.encode())
            return

        m = re.match(r"^/releases/(v\d+\.\d+\.\d+)$", path)
        if m:
            version = m.group(1)
            release = next((r for r in RELEASES if r["version"] == version), None)
            if release is None:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Release not found")
                return

            # Interleave policy and other changes in one list so the agent must
            # read and discriminate — the page does NOT separate them into labeled sections.
            all_items = []
            for c in release["policy_changes"]:
                all_items.append(f"<li>{escape_html(c)}</li>")
            for c in release["other_changes"]:
                all_items.append(f"<li>{escape_html(c)}</li>")

            changes_html = "<ul>\n" + "\n".join(all_items) + "\n</ul>"

            html = DETAIL_HTML.format(
                version=release["version"],
                title=escape_html(release["title"]),
                date=release["date"],
                changes_html=changes_html,
            )
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html.encode())
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not found")


if __name__ == "__main__":
    server = http.server.HTTPServer((HOST, PORT), PolicyHandler)
    print(f"Policy update portal on {HOST}:{PORT}")
    server.serve_forever()
