#!/usr/bin/env python3
"""Mock pricing website server for pricing-matrix-reconcile task."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

# Canonical plan ID → website display label mapping (agent must infer this)
PLAN_META = {
    "PLAN_F": {"label": "Starter", "tier": "free-tier", "users": "1 user", "storage": "1 GB"},
    "PLAN_P": {"label": "Growth",  "tier": "team-5",    "users": "5 users", "storage": "10 GB"},
    "PLAN_B": {"label": "Scale",   "tier": "team-20",   "users": "20 users", "storage": "50 GB"},
    "PLAN_E": {"label": "Horizon", "tier": "enterprise", "users": "Unlimited users", "storage": "200 GB"},
}

# Pricing data: region → billing_cycle → plan_label → {price, api_calls}
# api_calls is tooltip-only (not shown in card body)
PRICING = {
    "US": {
        "monthly": {
            "Starter": {"price": "$0/mo",    "api_calls": "500"},
            "Growth":  {"price": "$29/mo",   "api_calls": "5,000"},
            "Scale":   {"price": "$99/mo",   "api_calls": "25,000"},
            "Horizon": {"price": "$299/mo",  "api_calls": "Unlimited"},
        },
        "annual": {
            "Starter": {"price": "$0/mo",    "api_calls": "500"},
            "Growth":  {"price": "$23/mo",   "api_calls": "5,000"},
            "Scale":   {"price": "$79/mo",   "api_calls": "25,000"},
            "Horizon": {"price": "$239/mo",  "api_calls": "Unlimited"},
        },
    },
    "EU": {
        "monthly": {
            "Starter": {"price": "€0/mo",    "api_calls": "500"},
            "Growth":  {"price": "€27/mo",   "api_calls": "5,000"},
            "Scale":   {"price": "€91/mo",   "api_calls": "25,000"},
            "Horizon": {"price": "€275/mo",  "api_calls": "Unlimited"},
        },
        "annual": {
            "Starter": {"price": "€0/mo",    "api_calls": "500"},
            "Growth":  {"price": "€21/mo",   "api_calls": "5,000"},
            "Scale":   {"price": "€73/mo",   "api_calls": "25,000"},
            "Horizon": {"price": "€220/mo",  "api_calls": "Unlimited"},
        },
    },
}

# Legacy/archive pricing (linked from footer — outdated, should not be used)
LEGACY_PRICING = {
    "US": {
        "monthly": {
            "Starter": "$0/mo", "Growth": "$39/mo", "Scale": "$119/mo", "Horizon": "$349/mo",
        },
    },
}

PLAN_ORDER = ["Starter", "Growth", "Scale", "Horizon"]

CSS = """
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #f8f9fa; color: #1a1a2e; }
header { background: #1a1a2e; color: #fff; padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; }
header h1 { margin: 0; font-size: 1.4rem; }
.nav-link { color: #aed9ff; text-decoration: none; margin-left: 1.5rem; font-size: 0.9rem; }
main { max-width: 1100px; margin: 2rem auto; padding: 0 1.5rem; }
.controls { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
.region-select { padding: 0.45rem 0.8rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; cursor: pointer; }
.tabs { display: flex; gap: 0; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; }
.tab-btn { padding: 0.45rem 1.2rem; background: #fff; border: none; cursor: pointer; font-size: 1rem; transition: background 0.15s; }
.tab-btn.active { background: #1a1a2e; color: #fff; }
.plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1.2rem; }
.plan-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1.4rem; position: relative; }
.plan-name { font-size: 1.15rem; font-weight: 700; margin: 0 0 0.3rem; }
.plan-price { font-size: 2rem; font-weight: 700; color: #1a1a2e; margin: 0.5rem 0; }
.plan-feature { font-size: 0.92rem; color: #555; margin: 0.25rem 0; }
.plan-api { font-size: 0.88rem; color: #777; margin-top: 0.6rem; display: flex; align-items: center; gap: 0.3rem; }
.tooltip-trigger { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: #ddd; font-size: 0.72rem; cursor: help; position: relative; }
.tooltip-trigger:hover .tooltip-box, .tooltip-trigger:focus .tooltip-box { display: block; }
.tooltip-box { display: none; position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%); background: #1a1a2e; color: #fff; padding: 0.35rem 0.65rem; border-radius: 4px; white-space: nowrap; font-size: 0.82rem; z-index: 10; }
.tooltip-box::after { content: ""; position: absolute; top: 100%; left: 50%; transform: translateX(-50%); border: 5px solid transparent; border-top-color: #1a1a2e; }
footer { margin-top: 3rem; padding: 1.2rem 2rem; background: #eee; text-align: center; font-size: 0.85rem; color: #666; }
footer a { color: #555; }
"""

JS = """
const PRICING = """ + json.dumps(PRICING) + """;
const PLAN_META = """ + json.dumps(PLAN_META) + """;
const PLAN_ORDER = """ + json.dumps(PLAN_ORDER) + """;

let currentRegion = 'US';
let currentCycle = 'monthly';

function render() {
    const grid = document.getElementById('plans-grid');
    const data = PRICING[currentRegion][currentCycle];
    grid.innerHTML = '';
    for (const label of PLAN_ORDER) {
        const p = data[label];
        const meta = Object.values(PLAN_META).find(m => m.label === label);
        const card = document.createElement('div');
        card.className = 'plan-card';
        card.innerHTML = `
            <p class="plan-name">${label}</p>
            <p class="plan-price">${p.price}</p>
            <p class="plan-feature">${meta.users}</p>
            <p class="plan-feature">${meta.storage} storage</p>
            <p class="plan-api">
                API calls/month
                <span class="tooltip-trigger" tabindex="0">?
                    <span class="tooltip-box">${p.api_calls} API calls/month</span>
                </span>
            </p>
        `;
        grid.appendChild(card);
    }
}

document.getElementById('region-select').addEventListener('change', function() {
    currentRegion = this.value;
    render();
});

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        currentCycle = this.dataset.cycle;
        render();
    });
});

render();
"""

MAIN_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Nexora Pricing</title>
<style>{css}</style>
</head>
<body>
<header>
  <h1>Nexora</h1>
  <nav>
    <a class="nav-link" href="/">Pricing</a>
    <a class="nav-link" href="/docs">Docs</a>
    <a class="nav-link" href="/contact">Contact</a>
  </nav>
</header>
<main>
  <h2>Simple, transparent pricing</h2>
  <p>Choose the plan that works for your team. All plans include a 14-day free trial.</p>
  <div class="controls">
    <label>
      Region:
      <select id="region-select" class="region-select">
        <option value="US">US (USD)</option>
        <option value="EU">EU (EUR)</option>
      </select>
    </label>
    <div class="tabs">
      <button class="tab-btn active" data-cycle="monthly">Monthly</button>
      <button class="tab-btn" data-cycle="annual">Annual <small>(save ~20%)</small></button>
    </div>
  </div>
  <div class="plans-grid" id="plans-grid"></div>
</main>
<footer>
  &copy; 2026 Nexora Inc. &nbsp;|&nbsp;
  <a href="/legacy-pricing">Legacy pricing (archive)</a>
</footer>
<script>{js}</script>
</body>
</html>
""".format(css=CSS, js=JS)

LEGACY_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Nexora — Legacy Pricing (Archive)</title>
<style>{css}</style>
</head>
<body>
<header>
  <h1>Nexora &mdash; Legacy Pricing</h1>
  <nav><a class="nav-link" href="/">Back to current pricing</a></nav>
</header>
<main>
  <div style="background:#fff3cd;border:1px solid #ffc107;border-radius:6px;padding:1rem 1.3rem;margin-bottom:1.5rem;">
    <strong>&#9888; Archive notice:</strong> This page shows pricing that was in effect before January 2026. It is provided for reference only. <a href="/">View current pricing.</a>
  </div>
  <h2>US Monthly (Archive)</h2>
  <table style="border-collapse:collapse;width:100%;background:#fff;">
    <thead><tr><th style="padding:0.6rem 1rem;border:1px solid #ddd;text-align:left;">Plan</th><th style="padding:0.6rem 1rem;border:1px solid #ddd;text-align:left;">Price</th></tr></thead>
    <tbody>
      <tr><td style="padding:0.6rem 1rem;border:1px solid #ddd;">Starter</td><td style="padding:0.6rem 1rem;border:1px solid #ddd;">$0/mo</td></tr>
      <tr><td style="padding:0.6rem 1rem;border:1px solid #ddd;">Growth</td><td style="padding:0.6rem 1rem;border:1px solid #ddd;">$39/mo</td></tr>
      <tr><td style="padding:0.6rem 1rem;border:1px solid #ddd;">Scale</td><td style="padding:0.6rem 1rem;border:1px solid #ddd;">$119/mo</td></tr>
      <tr><td style="padding:0.6rem 1rem;border:1px solid #ddd;">Horizon</td><td style="padding:0.6rem 1rem;border:1px solid #ddd;">$349/mo</td></tr>
    </tbody>
  </table>
</main>
<footer>&copy; 2026 Nexora Inc. &nbsp;|&nbsp; <a href="/">Current pricing</a></footer>
</body>
</html>
""".format(css=CSS)

NOT_FOUND_PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>404</title></head>
<body><h1>404 Not Found</h1><p><a href="/">Back to pricing</a></p></body></html>
"""


class PricingHandler(BaseHTTPRequestHandler):
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

        if path in ("/", "/pricing"):
            self.send_html(200, MAIN_PAGE)
            return

        if path == "/legacy-pricing":
            self.send_html(200, LEGACY_PAGE)
            return

        self.send_html(404, NOT_FOUND_PAGE)


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8200)
    args = parser.parse_args()
    server = ThreadingHTTPServer((args.host, args.port), PricingHandler)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
