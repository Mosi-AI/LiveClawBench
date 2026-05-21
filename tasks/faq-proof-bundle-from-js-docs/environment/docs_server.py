#!/usr/bin/env python3
"""
Mock documentation website for faq-proof-bundle-from-js-docs task.

Current documentation (correct, authoritative):
  /docs/sso          — SSO via SAML 2.0 (seed phrase: "single sign-on via SAML 2.0")
  /docs/audit-logs   — Audit log retention 90 days (seed phrase: "audit log retention 90 days")
  /docs/data-export  — Export CSV/JSON (seed phrase: "export in CSV or JSON format")
  /faq               — FAQ page with JS-rendered accordion sections

Archived / outdated page (contaminated initial state, A2 factor):
  /archive/faq       — Contains "This page has been archived and may contain outdated information."
                       and an incorrect claim that SSO is not supported.

The agent must use current docs, not the archived page.
"""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

CSS = """
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #fff; color: #111; }
header { background: #0f4c5c; color: #fff; padding: 0.9rem 2rem; display: flex; align-items: center; justify-content: space-between; }
header h1 { margin: 0; font-size: 1.3rem; }
.nav-link { color: #b2eaff; text-decoration: none; margin-left: 1.2rem; font-size: 0.9rem; }
.nav-link:hover { text-decoration: underline; }
.sidebar-layout { display: flex; max-width: 1100px; margin: 0 auto; padding: 1.5rem; gap: 2rem; }
aside { width: 210px; flex-shrink: 0; }
aside h3 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; color: #777; margin: 0 0 0.5rem; }
aside ul { list-style: none; padding: 0; margin: 0 0 1.5rem; }
aside li a { display: block; padding: 0.3rem 0; color: #0f4c5c; font-size: 0.92rem; text-decoration: none; }
aside li a:hover { text-decoration: underline; }
main { flex: 1; min-width: 0; }
h2 { margin-top: 0; color: #0f4c5c; }
.badge { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 3px; font-size: 0.8rem; font-weight: 600; }
.badge-yes { background: #d4edda; color: #155724; }
.badge-no { background: #f8d7da; color: #721c24; }
.search-box { width: 100%; padding: 0.55rem 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; margin-bottom: 0.4rem; }
.search-btn { padding: 0.55rem 1.1rem; background: #0f4c5c; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
.search-result { padding: 0.5rem 0; border-bottom: 1px solid #eee; }
.search-result a { color: #0f4c5c; font-weight: 600; }
.accordion-item { border: 1px solid #ddd; border-radius: 4px; margin-bottom: 0.6rem; overflow: hidden; }
.accordion-trigger { width: 100%; padding: 0.75rem 1rem; background: #f5f8fa; border: none; text-align: left; font-size: 1rem; cursor: pointer; font-weight: 600; display: flex; justify-content: space-between; align-items: center; }
.accordion-trigger:hover { background: #e8f4f8; }
.accordion-content { display: none; padding: 0.8rem 1rem; background: #fff; line-height: 1.6; }
.accordion-content.open { display: block; }
.archive-banner { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 0.8rem 1rem; margin-bottom: 1.2rem; }
footer { margin-top: 2rem; padding: 1rem 2rem; background: #f5f5f5; text-align: center; font-size: 0.82rem; color: #777; }
code { background: #f0f0f0; padding: 0.1rem 0.35rem; border-radius: 3px; font-size: 0.9em; }
"""

SEARCH_DATA = [
    {"title": "Single Sign-On (SSO)", "url": "/docs/sso",
     "snippet": "Configure single sign-on via SAML 2.0 and OAuth 2.0 for your organization."},
    {"title": "Audit Logs", "url": "/docs/audit-logs",
     "snippet": "Full audit log retention for 90 days. Export logs for compliance."},
    {"title": "Data Export", "url": "/docs/data-export",
     "snippet": "Export your data in CSV or JSON format at any time from the dashboard."},
    {"title": "API Reference", "url": "/docs/api",
     "snippet": "Complete REST API reference with authentication and rate limits."},
    {"title": "FAQ", "url": "/faq",
     "snippet": "Frequently asked questions about features, billing, and security."},
]

SEARCH_JS = f"""
const SEARCH_DATA = {json.dumps(SEARCH_DATA)};
function doSearch() {{
    const q = document.getElementById('search-input').value.toLowerCase().trim();
    const results = document.getElementById('search-results');
    results.innerHTML = '';
    if (!q) {{ results.innerHTML = '<p>Enter a search term above.</p>'; return; }}
    const matches = SEARCH_DATA.filter(d =>
        d.title.toLowerCase().includes(q) ||
        d.snippet.toLowerCase().includes(q)
    );
    if (matches.length === 0) {{
        results.innerHTML = '<p>No results found.</p>';
        return;
    }}
    matches.forEach(d => {{
        results.innerHTML += `<div class="search-result">
            <a href="${{d.url}}">${{d.title}}</a>
            <p style="margin:0.2rem 0 0;font-size:0.88rem;color:#555">${{d.snippet}}</p>
        </div>`;
    }});
}}
document.getElementById('search-btn').addEventListener('click', doSearch);
document.getElementById('search-input').addEventListener('keydown', function(e) {{
    if (e.key === 'Enter') doSearch();
}});
"""

ACCORDION_JS = """
document.querySelectorAll('.accordion-trigger').forEach(function(btn) {
    btn.addEventListener('click', function() {
        var content = this.nextElementSibling;
        var isOpen = content.classList.contains('open');
        // Close all
        document.querySelectorAll('.accordion-content').forEach(function(c) {
            c.classList.remove('open');
            c.previousElementSibling.setAttribute('aria-expanded', 'false');
            c.previousElementSibling.querySelector('.acc-icon').textContent = '+';
        });
        if (!isOpen) {
            content.classList.add('open');
            this.setAttribute('aria-expanded', 'true');
            this.querySelector('.acc-icon').textContent = '−';
        }
    });
});
"""


def page(title: str, inner: str, extra_js: str = "") -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title} — Nexora Docs</title>
<style>{CSS}</style>
</head>
<body>
<header>
  <span style="font-weight:700;font-size:1.2rem;">Nexora Docs</span>
  <nav>
    <a class="nav-link" href="/">Home</a>
    <a class="nav-link" href="/faq">FAQ</a>
    <a class="nav-link" href="/docs/sso">SSO</a>
    <a class="nav-link" href="/docs/audit-logs">Audit Logs</a>
    <a class="nav-link" href="/docs/data-export">Data Export</a>
  </nav>
</header>
<div class="sidebar-layout">
  <aside>
    <h3>Security</h3>
    <ul>
      <li><a href="/docs/sso">Single Sign-On</a></li>
      <li><a href="/docs/audit-logs">Audit Logs</a></li>
    </ul>
    <h3>Data</h3>
    <ul>
      <li><a href="/docs/data-export">Data Export</a></li>
      <li><a href="/docs/api">API Reference</a></li>
    </ul>
    <h3>Help</h3>
    <ul>
      <li><a href="/faq">FAQ</a></li>
    </ul>
  </aside>
  <main>
    {inner}
  </main>
</div>
<footer>&copy; 2026 Nexora Inc.</footer>
{('<script>' + extra_js + '</script>') if extra_js else ''}
</body>
</html>"""


HOME_INNER = """
<h2>Nexora Documentation</h2>
<p>Welcome to the Nexora docs. Use the search below or browse topics in the sidebar.</p>
<input id="search-input" class="search-box" type="text" placeholder="Search docs (e.g. SSO, audit logs, data export)…" />
<button id="search-btn" class="search-btn">Search</button>
<div id="search-results" style="margin-top:1rem;"></div>
"""

SSO_INNER = """
<h2>Single Sign-On (SSO) <span class="badge badge-yes">Supported</span></h2>
<p>Nexora supports <strong>single sign-on via SAML 2.0</strong> and OAuth 2.0, allowing your
organization to authenticate users through your existing identity provider (IdP).</p>
<h3>Supported protocols</h3>
<ul>
  <li><strong>SAML 2.0</strong> — compatible with Okta, Azure AD, OneLogin, and other enterprise IdPs</li>
  <li><strong>OAuth 2.0 / OIDC</strong> — compatible with Google Workspace, GitHub, and custom IdPs</li>
</ul>
<h3>Setup</h3>
<p>Go to <code>Settings → Security → SSO</code> and upload your IdP metadata XML or enter the
IdP endpoint URL. Nexora will automatically configure SAML assertions and attribute mapping.</p>
<h3>Availability</h3>
<p>SSO is available on the Scale and Horizon plans. Growth plan users can request a 14-day SSO trial.</p>
"""

AUDIT_INNER = """
<h2>Audit Logs <span class="badge badge-yes">Supported</span></h2>
<p>Nexora records a full audit trail of all user and system actions. <strong>Audit log retention
90 days</strong> is included on all paid plans; Horizon plan customers can extend retention up to
2 years.</p>
<h3>What is logged</h3>
<ul>
  <li>User authentication events (login, logout, failed attempts)</li>
  <li>Permission and role changes</li>
  <li>Data access and export events</li>
  <li>API key creation and revocation</li>
  <li>Configuration changes (SSO, billing, integrations)</li>
</ul>
<h3>Accessing logs</h3>
<p>Navigate to <code>Settings → Security → Audit Logs</code>. You can filter by date range,
actor, action type, and resource. Logs can be exported as JSON or streamed to a SIEM via webhook.</p>
"""

DATA_EXPORT_INNER = """
<h2>Data Export <span class="badge badge-yes">Supported</span></h2>
<p>You can <strong>export in CSV or JSON format</strong> at any time from the Nexora dashboard.
No data lock-in — your data is always yours.</p>
<h3>Available exports</h3>
<ul>
  <li><strong>Full account export</strong> — all workspaces, projects, and members (JSON)</li>
  <li><strong>Project export</strong> — individual project data including tasks and comments (CSV or JSON)</li>
  <li><strong>Audit log export</strong> — activity records for compliance (JSON)</li>
  <li><strong>Billing export</strong> — invoice history and usage records (CSV)</li>
</ul>
<h3>How to export</h3>
<p>Go to <code>Settings → Data → Export</code>, choose the scope and format, then click
<em>Request Export</em>. A download link will be emailed within a few minutes for large exports.</p>
<h3>API export</h3>
<p>Programmatic exports are available via the REST API. See the
<a href="/docs/api">API Reference</a> for the <code>GET /v1/export</code> endpoint.</p>
"""

FAQ_INNER = """
<h2>Frequently Asked Questions</h2>
<p>Click a question to expand the answer.</p>

<div class="accordion-item">
  <button class="accordion-trigger" aria-expanded="false">
    Does Nexora support SSO? <span class="acc-icon">+</span>
  </button>
  <div class="accordion-content">
    Yes. Nexora supports <strong>single sign-on via SAML 2.0</strong> and OAuth 2.0/OIDC.
    See the <a href="/docs/sso">SSO documentation</a> for setup instructions.
  </div>
</div>

<div class="accordion-item">
  <button class="accordion-trigger" aria-expanded="false">
    How long are audit logs retained? <span class="acc-icon">+</span>
  </button>
  <div class="accordion-content">
    <strong>Audit log retention 90 days</strong> on Growth and Scale plans; up to 2 years on
    Horizon. All retention periods are configurable in <code>Settings → Security → Audit Logs</code>.
    See the <a href="/docs/audit-logs">Audit Logs documentation</a> for details.
  </div>
</div>

<div class="accordion-item">
  <button class="accordion-trigger" aria-expanded="false">
    Can I export my data? <span class="acc-icon">+</span>
  </button>
  <div class="accordion-content">
    Yes. You can <strong>export in CSV or JSON format</strong> at any time from
    <code>Settings → Data → Export</code>. See the
    <a href="/docs/data-export">Data Export documentation</a> for the full list of export types.
  </div>
</div>

<div class="accordion-item">
  <button class="accordion-trigger" aria-expanded="false">
    What regions is Nexora available in? <span class="acc-icon">+</span>
  </button>
  <div class="accordion-content">
    Nexora operates data centres in the US (Virginia, Oregon) and EU (Frankfurt, Dublin).
    Region selection is available on Scale and Horizon plans.
  </div>
</div>

<div class="accordion-item">
  <button class="accordion-trigger" aria-expanded="false">
    Is there a free plan? <span class="acc-icon">+</span>
  </button>
  <div class="accordion-content">
    Yes. The Starter plan is free forever for individual users (1 seat, 1 GB storage).
    All paid plans include a 14-day free trial, no credit card required.
  </div>
</div>
"""

ARCHIVE_FAQ_INNER = """
<div class="archive-banner">
  <strong>&#9888; Archive notice:</strong> This page has been archived and may contain outdated information.
  For current documentation please visit the <a href="/faq">current FAQ</a>.
</div>
<h2>FAQ (Archived — Last updated: September 2024)</h2>

<h3>Does Nexora support SSO?</h3>
<p>SSO is not currently supported on this platform. We plan to add SAML-based single sign-on in a
future release. Please contact sales if this is a blocking requirement.</p>

<h3>How long are audit logs retained?</h3>
<p>Audit logs are retained for 30 days on all plans. Extended retention is not available.</p>

<h3>Can I export my data?</h3>
<p>Data export is available in CSV format only for project-level data. Full account export is on the
roadmap.</p>
"""


class DocsHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def send_html(self, status: int, body: str) -> None:
        payload = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, status: int, data: object) -> None:
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:
        path = urlparse(self.path).path.rstrip("/") or "/"

        if path == "/health":
            self.send_json(200, {"ok": True})
            return

        if path in ("/", "/docs"):
            self.send_html(200, page("Home", HOME_INNER, SEARCH_JS))
            return

        if path == "/docs/sso":
            self.send_html(200, page("Single Sign-On", SSO_INNER))
            return

        if path == "/docs/audit-logs":
            self.send_html(200, page("Audit Logs", AUDIT_INNER))
            return

        if path == "/docs/data-export":
            self.send_html(200, page("Data Export", DATA_EXPORT_INNER))
            return

        if path == "/faq":
            self.send_html(200, page("FAQ", FAQ_INNER, ACCORDION_JS))
            return

        if path == "/archive/faq":
            self.send_html(200, page("FAQ (Archive)", ARCHIVE_FAQ_INNER))
            return

        not_found = page("Not Found", "<h2>Page not found</h2><p><a href='/'>Back to docs</a></p>")
        self.send_html(404, not_found)


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8201)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), DocsHandler)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
