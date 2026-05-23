#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

EN_POLICY_HTML = """\
<!DOCTYPE html>
<html>
<head><title>Data Retention Policy - Meridian Analytics</title></head>
<body>
<nav>
  <a href="/">Home</a> |
  <a href="/en/policy">English Policy</a> |
  <a href="/eu/policy">EU Policy</a>
</nav>
<h1>Data Retention Policy &mdash; English</h1>
<p>Effective date: 2026-01-01</p>
<h2>Retention Period</h2>
<p>We retain your data for up to 24 months.</p>
<h2>Deletion</h2>
<p>Deletion requests are processed within 30 days.</p>
<h2>Data Export</h2>
<p>You may export your data in CSV or Excel format.</p>
<h2>Data Sharing</h2>
<p>Your data may be shared with trusted analytics partners.</p>
<h2>Contact</h2>
<p>privacy@meridiananalytics.example</p>
</body>
</html>
"""

EU_POLICY_HTML = """\
<!DOCTYPE html>
<html>
<head><title>Data Retention Policy (EU) - Meridian Analytics</title></head>
<body>
<nav>
  <a href="/">Home</a> |
  <a href="/en/policy">English Policy</a> |
  <a href="/eu/policy">EU Policy</a>
</nav>
<h1>Data Retention Policy &mdash; EU</h1>
<p>Effective date: 2026-01-01</p>
<h2>Retention Period</h2>
<p>We retain your data for up to 12 months.</p>
<h2>Deletion</h2>
<p>Deletion requests are processed within 72 hours under GDPR Article 17.</p>
<h2>Data Export</h2>
<p>You may export your data in CSV only (machine-readable format).</p>
<h2>Data Sharing</h2>
<p>No sharing without explicit consent from the data subject.</p>
<h2>Contact</h2>
<p>privacy-eu@meridiananalytics.example</p>
</body>
</html>
"""

COOKIE_WALL_HTML = """\
<!DOCTYPE html>
<html>
<head><title>Data Retention Policy (EU) - Meridian Analytics</title></head>
<body>
<div id="consent-overlay" style="position:fixed;top:0;left:0;width:100%;height:100%;\
background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;\
justify-content:center;">
  <div style="background:white;padding:40px;border-radius:8px;text-align:center;">
    <h2>Cookie Consent Required</h2>
    <p>This site uses cookies to comply with EU regulations.</p>
    <form method="POST" action="/accept-cookies">
      <button type="submit">Accept All Cookies</button>
    </form>
  </div>
</div>
<h1>Data Retention Policy &mdash; EU</h1>
<p>Please accept cookies to view this page.</p>
</body>
</html>
"""

HOME_HTML = """\
<!DOCTYPE html>
<html>
<head><title>Meridian Analytics Policy Portal</title></head>
<body>
<h1>Meridian Analytics Policy Portal</h1>
<nav>
  <ul>
    <li><a href="/en/policy">English Policy</a></li>
    <li><a href="/eu/policy">EU Policy</a></li>
    <li><a href="/support/data-retention-faq">Support FAQ</a></li>
    <li><a href="/blog/privacy-update">Blog</a></li>
  </ul>
</nav>
</body>
</html>
"""

SUPPORT_FAQ_HTML = """\
<!DOCTYPE html>
<html>
<head><title>Support FAQ - Meridian Analytics</title></head>
<body>
<nav>
  <a href="/">Home</a> |
  <a href="/en/policy">English Policy</a> |
  <a href="/eu/policy">EU Policy</a>
</nav>
<h1>Support FAQ &mdash; Meridian Analytics</h1>
<h2>General Questions About Data</h2>
<p><strong>Q: How long is my retention period?</strong><br>
A: Please refer to the official policy pages for your region.</p>
<p><strong>Q: How do I request deletion?</strong><br>
A: Submit a deletion request through our privacy portal.</p>
<p><strong>Q: What export formats are available?</strong><br>
A: Export options depend on your account type and region.</p>
<p><em>Note: This page is a support resource, not the official policy document.</em></p>
</body>
</html>
"""

BLOG_HTML = """\
<!DOCTYPE html>
<html>
<head><title>Blog - Meridian Analytics</title></head>
<body>
<nav>
  <a href="/">Home</a> |
  <a href="/en/policy">English Policy</a> |
  <a href="/eu/policy">EU Policy</a>
</nav>
<h1>Blog &mdash; Meridian Analytics</h1>
<h2>Our Commitment to Privacy</h2>
<p>At Meridian Analytics, we take your privacy seriously. Our updated retention
practices reflect our ongoing commitment to data protection.</p>
<p>We have been working closely with regulators to ensure our privacy update
meets the latest standards. Stay tuned for more information.</p>
<p><em>This is a blog post and does not constitute official policy.</em></p>
</body>
</html>
"""


def parse_cookies(cookie_header):
    cookies = {}
    if not cookie_header:
        return cookies
    for part in cookie_header.split(";"):
        part = part.strip()
        if "=" in part:
            k, v = part.split("=", 1)
            cookies[k.strip()] = v.strip()
    return cookies


class PolicyHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def send_html(self, html, status=200):
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health":
            body = b'{"ok": true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        elif path == "/":
            self.send_html(HOME_HTML)

        elif path == "/en/policy":
            self.send_html(EN_POLICY_HTML)

        elif path == "/eu/policy":
            cookie_header = self.headers.get("Cookie", "")
            cookies = parse_cookies(cookie_header)
            if cookies.get("locale_consent") == "accepted":
                self.send_html(EU_POLICY_HTML)
            else:
                self.send_html(COOKIE_WALL_HTML)

        elif path == "/support/data-retention-faq":
            self.send_html(SUPPORT_FAQ_HTML)

        elif path == "/blog/privacy-update":
            self.send_html(BLOG_HTML)

        else:
            self.send_html("<html><body><h1>404 Not Found</h1></body></html>", 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/accept-cookies":
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length > 0:
                self.rfile.read(content_length)
            self.send_response(302)
            self.send_header("Set-Cookie", "locale_consent=accepted; Path=/")
            self.send_header("Location", "/eu/policy")
            self.end_headers()
        else:
            self.send_html("<html><body><h1>404 Not Found</h1></body></html>", 404)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8400), PolicyHandler)
    server.serve_forever()
