#!/usr/bin/env python3
"""Lightweight metrics collector — exposes /metrics on port 5000."""

import http.server
import json
import socketserver
import time

PORT = 5000


class MetricsHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        payload = json.dumps(
            {
                "uptime_seconds": int(time.time()),
                "service": "metrics-collector",
                "version": "0.1.0",
            }
        )
        self.wfile.write(payload.encode())

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    with socketserver.TCPServer(("0.0.0.0", PORT), MetricsHandler) as httpd:
        httpd.serve_forever()
