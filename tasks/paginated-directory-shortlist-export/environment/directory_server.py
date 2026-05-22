#!/usr/bin/env python3
"""
Mock PartnerHub directory for paginated-directory-shortlist-export task.

A2 — Contaminated Initial State:
  - Two duplicate vendor pairs (same vendor_id, different display names):
      V004: "DataForge Corp." and "DataForge Corporation"
      V008: "Helix Data Inc." and "Helix Data Incorporated"
  - One disabled filter chip ("Certified Partners") that looks active/selected
    but has the disabled attribute and does nothing when clicked.

B1 — Implicit Goal Resolution:
  - workspace/filter_spec.txt contains min_rating: 4.0
  - instruction says minimum rating=4.5
  - The file takes precedence, so 8 valid vendors qualify (not 5).

15 vendors total across 2 pages (10 + 5).
Valid vendors after applying all file-spec filters (Technology, North America,
rating >= 4.0, Active), deduplicated: V001-V008 = exactly 8.

Detail page (/vendor/<id>) exposes contact_email and contract_type — fields
that are NOT shown on the list cards.
"""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

PAGE_SIZE = 10

# Ground-truth vendor dataset
# Fields: vendor_id, vendor_name, category, region, rating, status,
#         contact_email (detail only), contract_type (detail only)
VENDORS = [
    # Page 1
    {
        "vendor_id": "V001",
        "vendor_name": "Apex Systems Inc.",
        "category": "Technology",
        "region": "North America",
        "rating": 4.8,
        "status": "Active",
        "contact_email": "bd@apexsystems.com",
        "contract_type": "Enterprise",
    },
    {
        "vendor_id": "V002",
        "vendor_name": "Brightwave Technologies",
        "category": "Technology",
        "region": "North America",
        "rating": 4.6,
        "status": "Active",
        "contact_email": "partners@brightwave.io",
        "contract_type": "Standard",
    },
    {
        "vendor_id": "V003",
        "vendor_name": "CloudNine Solutions",
        "category": "Technology",
        "region": "North America",
        "rating": 4.5,
        "status": "Active",
        "contact_email": "alliances@cloudnine.co",
        "contract_type": "Premium",
    },
    # V004 appears twice with different display names (duplicate pair)
    {
        "vendor_id": "V004",
        "vendor_name": "DataForge Corp.",
        "category": "Technology",
        "region": "North America",
        "rating": 4.2,
        "status": "Active",
        "contact_email": "sales@dataforge.com",
        "contract_type": "Standard",
    },
    {
        "vendor_id": "V004",
        "vendor_name": "DataForge Corporation",
        "category": "Technology",
        "region": "North America",
        "rating": 4.2,
        "status": "Active",
        "contact_email": "sales@dataforge.com",
        "contract_type": "Standard",
    },
    {
        "vendor_id": "V005",
        "vendor_name": "EdgePoint Analytics",
        "category": "Technology",
        "region": "North America",
        "rating": 4.1,
        "status": "Active",
        "contact_email": "partnerships@edgepoint.ai",
        "contract_type": "Standard",
    },
    {
        "vendor_id": "V006",
        "vendor_name": "FlowState Technologies",
        "category": "Technology",
        "region": "North America",
        "rating": 4.9,
        "status": "Active",
        "contact_email": "enterprise@flowstate.dev",
        "contract_type": "Enterprise",
    },
    {
        "vendor_id": "V007",
        "vendor_name": "GridMind Systems",
        "category": "Technology",
        "region": "North America",
        "rating": 4.7,
        "status": "Active",
        "contact_email": "biz@gridmind.com",
        "contract_type": "Premium",
    },
    # Invalid: wrong category
    {
        "vendor_id": "V009",
        "vendor_name": "LogiTrans Inc.",
        "category": "Logistics",
        "region": "North America",
        "rating": 4.5,
        "status": "Active",
        "contact_email": "info@logitrans.net",
        "contract_type": "Standard",
    },
    # Invalid: wrong region
    {
        "vendor_id": "V010",
        "vendor_name": "EuroTech GmbH",
        "category": "Technology",
        "region": "Europe",
        "rating": 4.6,
        "status": "Active",
        "contact_email": "partner@eurotech.de",
        "contract_type": "Enterprise",
    },
    # Page 2
    # V008 appears twice with different display names (duplicate pair)
    {
        "vendor_id": "V008",
        "vendor_name": "Helix Data Inc.",
        "category": "Technology",
        "region": "North America",
        "rating": 4.3,
        "status": "Active",
        "contact_email": "connect@helixdata.io",
        "contract_type": "Standard",
    },
    {
        "vendor_id": "V008",
        "vendor_name": "Helix Data Incorporated",
        "category": "Technology",
        "region": "North America",
        "rating": 4.3,
        "status": "Active",
        "contact_email": "connect@helixdata.io",
        "contract_type": "Standard",
    },
    # Invalid: wrong category
    {
        "vendor_id": "V011",
        "vendor_name": "NextGen Retail",
        "category": "Retail",
        "region": "North America",
        "rating": 4.4,
        "status": "Active",
        "contact_email": "trade@nextgenretail.com",
        "contract_type": "Standard",
    },
    # Invalid: below min_rating 4.0
    {
        "vendor_id": "V012",
        "vendor_name": "DataStream Pro",
        "category": "Technology",
        "region": "North America",
        "rating": 3.9,
        "status": "Active",
        "contact_email": "sales@datastreampro.com",
        "contract_type": "Standard",
    },
    # Invalid: inactive
    {
        "vendor_id": "V013",
        "vendor_name": "Pacific Dynamics",
        "category": "Technology",
        "region": "North America",
        "rating": 4.5,
        "status": "Inactive",
        "contact_email": "hello@pacificdynamics.com",
        "contract_type": "Premium",
    },
]

VENDOR_INDEX = {v["vendor_id"]: v for v in VENDORS}

CSS = """
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
       margin: 0; background: #f4f6fb; color: #1c1c2e; }
header { background: #1c1c2e; color: #fff; padding: 0.85rem 2rem;
         display: flex; align-items: center; justify-content: space-between; }
.logo { font-weight: 700; font-size: 1.2rem; }
.logo span { color: #6c9fff; }
.container { max-width: 1000px; margin: 2rem auto; padding: 0 1.5rem; }
h1 { font-size: 1.6rem; margin: 0 0 0.3rem; }
.subtitle { color: #666; margin: 0 0 1.5rem; font-size: 0.93rem; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem;
              align-items: center; }
.filter-bar label { font-size: 0.82rem; color: #555; margin-right: 0.2rem; }
.chip { display: inline-flex; align-items: center; padding: 0.3rem 0.85rem;
        border-radius: 999px; border: 1.5px solid #6c9fff; background: #6c9fff;
        color: #fff; font-size: 0.82rem; font-weight: 600; cursor: pointer;
        user-select: none; }
.chip.inactive { background: #fff; color: #6c9fff; cursor: pointer; }
.chip[disabled] { background: #d0d8f0; color: #7a8ab8; border-color: #b0bce8;
                  cursor: not-allowed; opacity: 0.85; }
.vendor-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px,1fr));
               gap: 1rem; margin-bottom: 1.5rem; }
.card { background: #fff; border: 1px solid #e2e8f4; border-radius: 8px;
        padding: 1.1rem 1.3rem; display: flex; flex-direction: column; gap: 0.35rem; }
.card h3 { margin: 0; font-size: 1rem; }
.card h3 a { color: #1c1c2e; text-decoration: none; }
.card h3 a:hover { text-decoration: underline; }
.card .meta { font-size: 0.82rem; color: #666; }
.card .rating { font-weight: 700; color: #f5a623; }
.badge { display: inline-block; padding: 0.1rem 0.45rem; border-radius: 3px;
         font-size: 0.75rem; font-weight: 600; }
.badge-active { background: #d4edda; color: #155724; }
.badge-inactive { background: #f8d7da; color: #721c24; }
.pagination { display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem; }
.page-btn { padding: 0.4rem 0.9rem; border: 1px solid #ccd6f0; border-radius: 4px;
            background: #fff; color: #444; text-decoration: none; font-size: 0.88rem; }
.page-btn.current { background: #1c1c2e; color: #fff; border-color: #1c1c2e; }
.detail-section { background: #fff; border: 1px solid #e2e8f4; border-radius: 8px;
                  padding: 1.4rem 1.8rem; margin-bottom: 1rem; }
.detail-section h2 { margin: 0 0 1rem; font-size: 1.15rem; }
.detail-row { display: flex; gap: 1rem; padding: 0.5rem 0;
              border-bottom: 1px solid #f0f2f8; font-size: 0.92rem; }
.detail-row:last-child { border-bottom: none; }
.detail-label { width: 160px; color: #666; flex-shrink: 0; }
.detail-value { font-weight: 500; }
footer { margin-top: 3rem; padding: 1rem 2rem; background: #1c1c2e;
         color: #7a8ab8; text-align: center; font-size: 0.8rem; }
"""

CERTIFIED_CHIP_TOOLTIP = "Certification filtering is unavailable in this view."


def stars(rating: float) -> str:
    full = int(rating)
    return "★" * full + ("½" if rating - full >= 0.5 else "") + f" {rating}"


def vendor_card(v: dict) -> str:
    badge_cls = "badge-active" if v["status"] == "Active" else "badge-inactive"
    return f"""
<div class="card">
  <h3><a href="/vendor/{v["vendor_id"]}">{v["vendor_name"]}</a></h3>
  <div class="meta">{v["category"]} &bull; {v["region"]}</div>
  <div class="rating">{stars(v["rating"])}</div>
  <div><span class="badge {badge_cls}">{v["status"]}</span></div>
</div>"""


def build_directory_page(page_num: int) -> str:
    total_pages = (len(VENDORS) + PAGE_SIZE - 1) // PAGE_SIZE
    start = (page_num - 1) * PAGE_SIZE
    page_vendors = VENDORS[start : start + PAGE_SIZE]

    cards_html = "".join(vendor_card(v) for v in page_vendors)

    pagination_html = ""
    for p in range(1, total_pages + 1):
        cls = "page-btn current" if p == page_num else "page-btn"
        pagination_html += f'<a href="/?page={p}" class="{cls}">Page {p}</a>'

    filter_bar = f"""
<div class="filter-bar">
  <label>Active filters:</label>
  <span class="chip">Technology</span>
  <span class="chip">North America</span>
  <span class="chip">Active</span>
  <span class="chip">&#9733; 4.5+</span>
  <span class="chip" disabled title="{CERTIFIED_CHIP_TOOLTIP}"
        aria-disabled="true">Certified &#10003;</span>
</div>
<p style="font-size:0.8rem;color:#888;margin-top:-0.8rem;margin-bottom:1.2rem">
  Note: the Certified filter chip is currently unavailable and does not affect results.
</p>"""

    inner = f"""
<div class="container">
  <h1>PartnerHub Directory</h1>
  <p class="subtitle">Find and shortlist verified technology partners.</p>
  {filter_bar}
  <p style="font-size:0.85rem;color:#555;margin-bottom:1rem">
    Showing page {page_num} of {total_pages}
    &nbsp;&bull;&nbsp; {len(VENDORS)} total listings
  </p>
  <div class="vendor-grid">{cards_html}</div>
  <div class="pagination">{pagination_html}</div>
</div>"""

    return _wrap_page("PartnerHub — Partner Directory", inner)


def build_detail_page(vendor_id: str) -> str:
    v = VENDOR_INDEX.get(vendor_id)
    if v is None:
        inner = '<div class="container"><h1>Vendor not found</h1></div>'
        return _wrap_page("Not Found — PartnerHub", inner), 404

    badge_cls = "badge-active" if v["status"] == "Active" else "badge-inactive"
    rows = [
        ("Vendor ID", v["vendor_id"]),
        ("Company Name", v["vendor_name"]),
        ("Category", v["category"]),
        ("Region", v["region"]),
        ("Rating", stars(v["rating"])),
        ("Status", f'<span class="badge {badge_cls}">{v["status"]}</span>'),
        ("Contact Email", v["contact_email"]),
        ("Contract Type", v["contract_type"]),
    ]
    rows_html = "".join(
        f'<div class="detail-row">'
        f'<span class="detail-label">{label}</span>'
        f'<span class="detail-value">{value}</span>'
        f"</div>"
        for label, value in rows
    )
    inner = f"""
<div class="container">
  <p style="margin-bottom:1rem">
    <a href="/" style="color:#6c9fff;text-decoration:none">&larr; Back to directory</a>
  </p>
  <h1>{v["vendor_name"]}</h1>
  <p class="subtitle">Vendor ID: {v["vendor_id"]}</p>
  <div class="detail-section">
    <h2>Vendor Details</h2>
    {rows_html}
  </div>
</div>"""
    return _wrap_page(f"{v['vendor_name']} — PartnerHub", inner), 200


def _wrap_page(title: str, inner: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>{CSS}</style>
</head>
<body>
<header>
  <span class="logo">Partner<span>Hub</span></span>
  <nav style="font-size:0.85rem;color:#a8b4c8">Partner Directory</nav>
</header>
{inner}
<footer>&copy; 2026 PartnerHub Inc.</footer>
</body>
</html>"""


class DirectoryHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        qs = parse_qs(parsed.query)

        if path == "/health":
            body = json.dumps({"ok": True}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path in ("/", ""):
            try:
                page_num = int(qs.get("page", ["1"])[0])
            except ValueError:
                page_num = 1
            page_num = max(1, page_num)
            html = build_directory_page(page_num)
            status = 200
        elif path.startswith("/vendor/"):
            vendor_id = path[len("/vendor/") :]
            result = build_detail_page(vendor_id)
            html, status = result
        else:
            html = _wrap_page(
                "404 — PartnerHub",
                '<div class="container"><h1>404</h1><p>Page not found.</p></div>',
            )
            status = 404

        body = html.encode()
        self.send_response(status)
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
    parser.add_argument("--port", type=int, default=8300)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), DirectoryHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
