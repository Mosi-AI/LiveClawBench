#!/usr/bin/env python3
"""
Mock release portal for release-note-regression-watch task.

Official release notes (authoritative):
  /releases/v1.2.0  — previous release
  /releases/v2.0.0  — latest release (current)

Changes from v1.2.0 → v2.0.0 (ground truth):
  1. "Export Reports"       renamed  → "Export Bundles"
  2. "Legacy CSV Import"    removed  (replaced by Universal Import)
  3. "Multi-tenant Workspaces" renamed → "Organizations"
  4. "AI Summaries"         demoted  → Beta
  5. "Weekly Digest Emails" removed  (replaced by Notification Center)

Marketing / blog (NOT official release notes):
  /blog/whats-new  — "PRODUCT BLOG" header, mentions "Verto Copilot" teaser
                     (coming in v3.0, not in any release notes).
"""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

CSS = """
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
       margin: 0; background: #f7f8fa; color: #1a1a2e; }
header { background: #1a1a2e; color: #fff; padding: 0.9rem 2rem;
         display: flex; align-items: center; justify-content: space-between; }
header .logo { font-weight: 700; font-size: 1.25rem; letter-spacing: -0.02em; }
nav a { color: #a8b4c8; text-decoration: none; margin-left: 1.4rem; font-size: 0.88rem; }
nav a:hover { color: #fff; }
.container { max-width: 860px; margin: 2rem auto; padding: 0 1.5rem; }
h1 { font-size: 1.7rem; margin: 0 0 0.3rem; }
.subtitle { color: #666; margin: 0 0 2rem; font-size: 0.95rem; }
.version-nav { display: flex; gap: 0.5rem; margin-bottom: 2rem; }
.version-btn { padding: 0.4rem 1rem; border: 1px solid #dde; border-radius: 4px;
               text-decoration: none; color: #444; font-size: 0.88rem; background: #fff; }
.version-btn.current { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }
.section { background: #fff; border: 1px solid #e4e8ef; border-radius: 6px;
           padding: 1.4rem 1.6rem; margin-bottom: 1.2rem; }
.section h2 { margin: 0 0 1rem; font-size: 1.1rem; color: #1a1a2e; }
.feature-list { list-style: none; padding: 0; margin: 0; }
.feature-list li { padding: 0.55rem 0; border-bottom: 1px solid #f0f0f5;
                   display: flex; align-items: baseline; gap: 0.7rem; }
.feature-list li:last-child { border-bottom: none; }
.badge { display: inline-block; padding: 0.12rem 0.5rem; border-radius: 3px;
         font-size: 0.74rem; font-weight: 600; white-space: nowrap; }
.badge-ga   { background: #d4edda; color: #155724; }
.badge-beta { background: #fff3cd; color: #856404; }
.badge-removed { background: #f8d7da; color: #721c24; }
.badge-new  { background: #cce5ff; color: #004085; }
.badge-renamed { background: #e2d9f3; color: #4a235a; }
.hero { background: #1a1a2e; color: #fff; padding: 3rem 2rem; text-align: center; }
.hero h2 { font-size: 2rem; margin: 0 0 0.5rem; }
.hero p { color: #a8b4c8; margin: 0 0 1.5rem; }
.cta-btn { display: inline-block; padding: 0.7rem 1.8rem; background: #4f8ef7;
           color: #fff; border-radius: 5px; text-decoration: none; font-weight: 600; }
.blog-banner { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;
               padding: 0.7rem 1rem; margin-bottom: 1.5rem; font-size: 0.88rem;
               font-weight: 600; color: #856404; }
footer { margin-top: 3rem; padding: 1.2rem 2rem; background: #1a1a2e;
         color: #a8b4c8; text-align: center; font-size: 0.8rem; }
"""


def page(title: str, inner: str, nav_active: str = "") -> str:
    links = [
        ("/", "Home"),
        ("/releases/v2.0.0", "v2.0.0"),
        ("/releases/v1.2.0", "v1.2.0"),
        ("/blog/whats-new", "Blog"),
    ]
    nav_html = "".join(
        f'<a href="{href}"{"" if nav_active != href else ' style="color:#fff"'}'
        f">{label}</a>"
        for href, label in links
    )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title} — Verto</title>
<style>{CSS}</style>
</head>
<body>
<header>
  <span class="logo">Verto</span>
  <nav>{nav_html}</nav>
</header>
{inner}
<footer>&copy; 2026 Verto Inc. All rights reserved.</footer>
</body>
</html>"""


HOME_INNER = """
<div class="hero">
  <h2>Verto Release Portal</h2>
  <p>Official release notes, changelogs, and product updates.</p>
  <a href="/releases/v2.0.0" class="cta-btn">View Latest Release &rarr;</a>
</div>
<div class="container">
  <h1 style="margin-top:2rem">Releases</h1>
  <p class="subtitle">Browse official release notes by version.</p>
  <div class="section">
    <h2>Latest</h2>
    <ul class="feature-list">
      <li><a href="/releases/v2.0.0"><strong>v2.0.0</strong></a>
          &nbsp;— Organizations, Export Bundles, Notification Center &nbsp;
          <span class="badge badge-new">Latest</span></li>
    </ul>
  </div>
  <div class="section">
    <h2>Previous</h2>
    <ul class="feature-list">
      <li><a href="/releases/v1.2.0"><strong>v1.2.0</strong></a>
          &nbsp;— AI Summaries GA, Multi-tenant Workspaces</li>
    </ul>
  </div>
  <p style="margin-top:1.5rem;font-size:0.85rem;color:#888">
    Looking for product highlights?
    <a href="/blog/whats-new">Read the What&rsquo;s New blog post &rarr;</a>
  </p>
</div>
"""

V1_INNER = """
<div class="container">
  <h1>Release Notes — v1.2.0</h1>
  <p class="subtitle">Released 2026-01-15 &bull; Previous release</p>
  <div class="version-nav">
    <a class="version-btn" href="/releases/v1.2.0" style="background:#1a1a2e;color:#fff;border-color:#1a1a2e">v1.2.0</a>
    <a class="version-btn" href="/releases/v2.0.0">v2.0.0 (latest)</a>
  </div>
  <div class="section">
    <h2>Features in v1.2.0</h2>
    <ul class="feature-list">
      <li><strong>Export Reports</strong>
          <span class="badge badge-ga">GA</span>
          <span style="color:#555;font-size:0.9rem">Export project data as CSV or Excel spreadsheets.</span></li>
      <li><strong>Legacy CSV Import</strong>
          <span class="badge badge-ga">GA</span>
          <span style="color:#555;font-size:0.9rem">Import tasks and records from legacy CSV files (up to 100 k rows).</span></li>
      <li><strong>Multi-tenant Workspaces</strong>
          <span class="badge badge-ga">GA</span>
          <span style="color:#555;font-size:0.9rem">Run isolated workspaces for multiple teams under one account.</span></li>
      <li><strong>AI Summaries</strong>
          <span class="badge badge-ga">GA</span>
          <span style="color:#555;font-size:0.9rem">Automatically generate document and meeting summaries using AI.</span></li>
      <li><strong>Weekly Digest Emails</strong>
          <span class="badge badge-ga">GA</span>
          <span style="color:#555;font-size:0.9rem">Receive a weekly digest of activity and upcoming due dates.</span></li>
      <li><strong>Custom Dashboards</strong>
          <span class="badge badge-ga">GA</span>
          <span style="color:#555;font-size:0.9rem">Build custom analytics dashboards from project metrics.</span></li>
      <li><strong>Audit Logs</strong>
          <span class="badge badge-ga">GA</span>
          <span style="color:#555;font-size:0.9rem">Full audit trail for all workspace actions.</span></li>
    </ul>
  </div>
</div>
"""

V2_INNER = """
<div class="container">
  <h1>Release Notes — v2.0.0</h1>
  <p class="subtitle">Released 2026-04-02 &bull; Latest release</p>
  <div class="version-nav">
    <a class="version-btn" href="/releases/v1.2.0">v1.2.0</a>
    <a class="version-btn" href="/releases/v2.0.0" style="background:#1a1a2e;color:#fff;border-color:#1a1a2e">v2.0.0 (latest)</a>
  </div>
  <div class="section">
    <h2>Changed in v2.0.0</h2>
    <ul class="feature-list">
      <li><strong>Export Bundles</strong>
          <span class="badge badge-renamed">Renamed</span>
          <span style="color:#555;font-size:0.9rem">Previously &ldquo;Export Reports&rdquo;. Now exports ZIP bundles containing CSV, Excel, and PDF formats together.</span></li>
      <li><strong>Organizations</strong>
          <span class="badge badge-renamed">Renamed</span>
          <span style="color:#555;font-size:0.9rem">Previously &ldquo;Multi-tenant Workspaces&rdquo;. Unified under the Organizations model with improved role management.</span></li>
      <li><strong>AI Summaries</strong>
          <span class="badge badge-beta">Beta</span>
          <span style="color:#555;font-size:0.9rem">Moved to Beta while the underlying model is upgraded. Access requires joining the Beta Program.</span></li>
    </ul>
  </div>
  <div class="section">
    <h2>Removed in v2.0.0</h2>
    <ul class="feature-list">
      <li><strong>Legacy CSV Import</strong>
          <span class="badge badge-removed">Removed</span>
          <span style="color:#555;font-size:0.9rem">Replaced by Universal Import, which supports CSV, JSON, XML, and direct database connections.</span></li>
      <li><strong>Weekly Digest Emails</strong>
          <span class="badge badge-removed">Removed</span>
          <span style="color:#555;font-size:0.9rem">Replaced by the new Notification Center with real-time and scheduled digest options.</span></li>
    </ul>
  </div>
  <div class="section">
    <h2>New in v2.0.0</h2>
    <ul class="feature-list">
      <li><strong>Universal Import</strong>
          <span class="badge badge-new">New</span>
          <span style="color:#555;font-size:0.9rem">Import from CSV, JSON, XML, or connect directly to external databases and APIs.</span></li>
      <li><strong>Notification Center</strong>
          <span class="badge badge-new">New</span>
          <span style="color:#555;font-size:0.9rem">Unified inbox for all workspace notifications with configurable digest schedules.</span></li>
    </ul>
  </div>
  <div class="section">
    <h2>Unchanged from v1.2.0</h2>
    <ul class="feature-list">
      <li><strong>Custom Dashboards</strong>
          <span class="badge badge-ga">GA</span>
          <span style="color:#555;font-size:0.9rem">No changes in this release.</span></li>
      <li><strong>Audit Logs</strong>
          <span class="badge badge-ga">GA</span>
          <span style="color:#555;font-size:0.9rem">No changes in this release.</span></li>
    </ul>
  </div>
</div>
"""

BLOG_INNER = """
<div class="container">
  <div class="blog-banner">
    &#128240; PRODUCT BLOG &mdash; This is a marketing post, not official release notes.
    For the authoritative changelog see
    <a href="/releases/v2.0.0">Release Notes v2.0.0</a>.
  </div>
  <h1>What&rsquo;s New in Verto v2.0.0</h1>
  <p class="subtitle">Posted 2026-04-05 &bull; By the Verto Product Team</p>
  <div class="section">
    <h2>Highlights for Teams</h2>
    <p>v2.0.0 is our biggest release yet. Here&rsquo;s what every team will love:</p>
    <ul>
      <li><strong>Export Bundles</strong> &mdash; richer exports with one-click ZIP downloads.</li>
      <li><strong>Organizations</strong> &mdash; a unified home for all your teams and workspaces.</li>
      <li><strong>Universal Import</strong> &mdash; bring data from anywhere in seconds.</li>
      <li><strong>Notification Center</strong> &mdash; smarter alerts, your way.</li>
    </ul>
  </div>
  <div class="section">
    <h2>Coming Soon &mdash; Verto Copilot</h2>
    <p>
      We&rsquo;re building <strong>Verto Copilot</strong>, an AI assistant that will be
      embedded directly into your workspace to help you draft plans, summarize threads,
      and generate reports on demand. Expect a preview in v3.0.
    </p>
    <p><em>Note: Verto Copilot is not yet released and is not part of v2.0.0.</em></p>
  </div>
  <div class="section">
    <h2>AI Summaries Update</h2>
    <p>
      AI Summaries is temporarily in Beta while we upgrade the underlying model.
      Existing GA users have been migrated to the Beta Program automatically.
    </p>
  </div>
</div>
"""


class ReleaseHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/health":
            body = json.dumps({"ok": True}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path in ("/", ""):
            html = page("Release Portal", HOME_INNER, "/")
        elif path == "/releases/v1.2.0":
            html = page("Release Notes v1.2.0", V1_INNER, "/releases/v1.2.0")
        elif path == "/releases/v2.0.0":
            html = page("Release Notes v2.0.0", V2_INNER, "/releases/v2.0.0")
        elif path == "/blog/whats-new":
            html = page("What's New in v2.0.0 | Blog", BLOG_INNER, "/blog/whats-new")
        else:
            html = page(
                "404 Not Found",
                '<div class="container"><h1>404</h1><p>Page not found.</p></div>',
            )
            body = html.encode()
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        body = html.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt: str, *args: object) -> None:
        pass


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8200)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), ReleaseHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
