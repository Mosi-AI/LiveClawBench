#!/usr/bin/env python3
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

RELEASES = [
    {
        "id": "PR001",
        "title": "Q1 Product Roadmap Update",
        "company": "Helix Technologies",
        "date": "2026-03-20",
        "archived": False,
        "syndicated": False,
    },
    {
        "id": "PR009",
        "title": "Quantum Bridge Unveils New Network Architecture",
        "company": "Quantum Bridge",
        "date": "2026-03-15",
        "archived": False,
        "syndicated": False,
    },
    {
        "id": "PR002",
        "title": "HLXC Expands to Southeast Asian Markets",
        "company": "HLXC",
        "date": "2026-03-05",
        "archived": False,
        "syndicated": False,
    },
    {
        "id": "PR008",
        "title": "HLXC Expands to Southeast Asian Markets",
        "company": "HLXC",
        "date": "2026-03-05",
        "archived": False,
        "syndicated": True,
    },
    {
        "id": "PR003",
        "title": "Helix Corp Announces Strategic Partnership",
        "company": "Helix Corp",
        "date": "2026-02-18",
        "archived": False,
        "syndicated": False,
    },
    {
        "id": "PR010",
        "title": "Meridian Systems Announces Cloud Upgrade",
        "company": "Meridian Systems",
        "date": "2026-02-01",
        "archived": False,
        "syndicated": False,
    },
    {
        "id": "PR004",
        "title": "Helix Closes $50M Series C Funding Round",
        "company": "Helix",
        "date": "2026-01-30",
        "archived": False,
        "syndicated": False,
    },
    {
        "id": "PR005",
        "title": "Helix Technologies Named Best Employer 2025",
        "company": "Helix Technologies",
        "date": "2025-12-15",
        "archived": False,
        "syndicated": False,
    },
    {
        "id": "PR006",
        "title": "HLXC Sustainability Report 2025",
        "company": "HLXC",
        "date": "2025-11-22",
        "archived": False,
        "syndicated": False,
    },
    {
        "id": "PR007",
        "title": "Helix Technologies Data Center Expansion",
        "company": "Helix Technologies",
        "date": "2025-08-10",
        "archived": True,
        "syndicated": False,
    },
]

RELEASES_BY_ID = {r["id"]: r for r in RELEASES}


def render_listing():
    items = []
    for r in RELEASES:
        badge = ""
        css_class = "release"
        if r["archived"]:
            badge = '<span class="badge">[ARCHIVED]</span> '
            css_class = "release archived"
        elif r["syndicated"]:
            css_class = "release syndicated"
        syndicated_badge = ""
        if r["syndicated"]:
            syndicated_badge = ' <span class="badge">[Syndicated]</span>'
        items.append(
            f'<div class="{css_class}">'
            f"{badge}"
            f'<a href="/releases/{r["id"]}">{r["title"]}</a>'
            f"{syndicated_badge}"
            f'<span class="meta">{r["company"]} &mdash; {r["date"]}</span>'
            f"</div>"
        )
    return "\n".join(items)


def render_release(r):
    url = f"http://localhost:8500/releases/{r['id']}"
    return f"""\
<!DOCTYPE html>
<html>
<head><title>{r['title']} - Helix Corp Pressroom</title></head>
<body>
<nav><a href="/">Back to Pressroom</a></nav>
<article>
  <h1>{r['title']}</h1>
  <p class="company">{r['company']}</p>
  <p class="date">{r['date']}</p>
  <p class="url">URL: <a href="{url}">{url}</a></p>
  <p>This press release was issued by {r['company']} on {r['date']}.</p>
</article>
</body>
</html>"""


def render_home():
    listing = render_listing()
    return f"""\
<!DOCTYPE html>
<html>
<head>
<title>Helix Corp Pressroom</title>
<style>
  .release {{ margin: 12px 0; padding: 8px; border-bottom: 1px solid #ddd; }}
  .archived {{ background: #f8f8f8; color: #888; }}
  .syndicated {{ background: #fffbe6; }}
  .badge {{ font-weight: bold; color: #c00; margin-right: 4px; }}
  .meta {{ display: block; font-size: 0.9em; color: #555; margin-top: 4px; }}
</style>
</head>
<body>
<h1>Helix Corp Pressroom</h1>
<p>Latest press releases &mdash; all regions</p>
{listing}
</body>
</html>"""


class PressroomHandler(BaseHTTPRequestHandler):
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
            self.send_html(render_home())

        elif path.startswith("/releases/"):
            release_id = path[len("/releases/"):]
            r = RELEASES_BY_ID.get(release_id)
            if r:
                self.send_html(render_release(r))
            else:
                self.send_html("<html><body><h1>404 Not Found</h1></body></html>", 404)

        else:
            self.send_html("<html><body><h1>404 Not Found</h1></body></html>", 404)


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8500), PressroomHandler)
    server.serve_forever()
