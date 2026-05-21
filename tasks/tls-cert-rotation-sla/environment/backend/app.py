#!/usr/bin/env python3
"""
Simple backend HTTP server for the webapp.
Runs on port 8080, proxied through Nginx at port 443.
"""

import datetime
import json
from http.server import BaseHTTPRequestHandler, HTTPServer


class BackendHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            self._json_response({"status": "healthy", "timestamp": self._now()})
        elif self.path == "/":
            self._html_response(self._index_page())
        else:
            self._html_response("<h1>404 Not Found</h1>", code=404)

    def _index_page(self):
        return f"""<!DOCTYPE html>
<html>
<head><title>WebApp Production</title></head>
<body>
    <h1>WebApp Production Server</h1>
    <p>Status: <strong>Running</strong></p>
    <p>Server Time: {self._now()}</p>
    <p>Backend Port: 8080</p>
    <hr>
    <p><a href="/health">Health Check</a></p>
</body>
</html>"""

    def _json_response(self, data, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _html_response(self, html, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(html.encode())

    def _now(self):
        return datetime.datetime.now(datetime.timezone.utc).isoformat()

    def log_message(self, format, *args):
        # Suppress default stderr logging
        pass


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8080), BackendHandler)
    print("[backend] Starting on port 8080")
    server.serve_forever()
