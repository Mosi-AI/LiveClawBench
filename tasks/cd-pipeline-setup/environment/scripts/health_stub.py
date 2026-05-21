#!/usr/bin/env python3
"""Legacy health-check endpoint — serves basic status on port 8080."""

import http.server
import json
import socketserver
import time

PORT = 8080


class HealthHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        payload = json.dumps(
            {
                "status": "healthy",
                "uptime": int(time.time()),
                "service": "legacy-health-stub",
            }
        )
        self.wfile.write(payload.encode())

    def log_message(self, format, *args):
        pass  # silent


if __name__ == "__main__":
    with socketserver.TCPServer(("0.0.0.0", PORT), HealthHandler) as httpd:
        httpd.serve_forever()
