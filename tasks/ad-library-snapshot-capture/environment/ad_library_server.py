"""BrandAd Library — mock ad library server for ad-library-snapshot-capture task."""

import http.server
import json
import urllib.parse

PORT = 8600
PAGE_SIZE = 5

CREATIVES = [
    {
        "creative_id": "AD001",
        "headline": "Summer Glow Collection — NovaLume",
        "status": "CURRENT",
        "campaign_name": "Summer 2026",
        "start_date": "2026-04-01",
        "end_date": "2026-08-31",
        "platform": "Meta",
        "description": "Brighten your summer with the new Summer Glow Collection from NovaLume. Featuring lightweight, illuminating formulas for radiant skin all season long.",
    },
    {
        "creative_id": "AD002",
        "headline": "NovaLume Hydration Serum Launch",
        "status": "CURRENT",
        "campaign_name": "Hydration 2026",
        "start_date": "2026-05-15",
        "end_date": "2026-09-15",
        "platform": "TikTok",
        "description": "Introducing the NovaLume Hydration Serum — deep moisture that lasts 72 hours. See visible results in just one week.",
    },
    {
        "creative_id": "AD003",
        "headline": "NovaLume x Creator Collab — Radiant Skin",
        "status": "CURRENT",
        "campaign_name": "Creator Q2 2026",
        "start_date": "2026-03-01",
        "end_date": "2026-06-30",
        "platform": "Instagram",
        "description": "NovaLume partners with top beauty creators for the Radiant Skin collection. Authentic reviews and real results.",
    },
    {
        "creative_id": "AD004",
        "headline": "NovaLume Winter Defense Moisturizer",
        "status": "CURRENT",
        "campaign_name": "Winter 2026",
        "start_date": "2026-02-01",
        "end_date": "2026-07-31",
        "platform": "Meta",
        "description": "Protect your skin from harsh winter conditions with NovaLume Winter Defense Moisturizer. Clinically tested barrier protection.",
    },
    {
        "creative_id": "AD005",
        "headline": "NovaLume Everyday Essentials Bundle",
        "status": "CURRENT",
        "campaign_name": "Essentials 2026",
        "start_date": "2026-01-15",
        "end_date": "2026-12-31",
        "platform": "Google",
        "description": "Get the complete NovaLume routine at a special bundle price. Cleanser, serum, moisturizer — everything you need for healthy skin.",
    },
    {
        "creative_id": "AD006",
        "headline": "NovaLume Holiday Gift Set 2025",
        "status": "PAUSED",
        "campaign_name": "Holiday 2025",
        "start_date": "2025-11-01",
        "end_date": "2026-01-15",
        "platform": "Meta",
        "description": "The perfect holiday gift for skincare lovers. Limited edition NovaLume gift set with best-selling minis.",
    },
    {
        "creative_id": "AD007",
        "headline": "NovaLume Spring Renewal Campaign",
        "status": "ARCHIVED",
        "campaign_name": "Spring 2025",
        "start_date": "2025-03-01",
        "end_date": "2025-05-31",
        "platform": "Instagram",
        "description": "Welcome spring with renewed skin. NovaLume's Spring Renewal collection features gentle exfoliants and brightening treatments.",
    },
    {
        "creative_id": "AD008",
        "headline": "NovaLume Father's Day Promotion",
        "status": "PAUSED",
        "campaign_name": "Father's Day 2025",
        "start_date": "2025-05-01",
        "end_date": "2025-06-30",
        "platform": "TikTok",
        "description": "Show dad some love with NovaLume grooming essentials. Curated sets for every dad's routine.",
    },
]

# Feed pages define which creative_ids appear on each page (1-indexed)
# AD001: pages 1,3; AD002: pages 1,2; AD005: pages 2,3
FEED_PAGES = {
    1: ["AD001", "AD002", "AD003", "AD006", "AD001"],  # AD001 duplicate on page 1
    2: ["AD004", "AD002", "AD005", "AD006", "AD008"],  # AD002 duplicate on page 2
    3: [
        "AD001",
        "AD005",
        "AD007",
        "AD008",
        "AD005",
    ],  # AD001, AD005 duplicate on page 3
}


def get_creative(creative_id):
    for c in CREATIVES:
        if c["creative_id"] == creative_id:
            return c
    return None


def build_feed_html(page=1):
    page_ids = FEED_PAGES.get(page, [])
    items_html = ""
    for cid in page_ids:
        c = get_creative(cid)
        if c is None:
            continue
        badge_class = c["status"].lower()
        items_html += f"""
        <div class="feed-item" data-creative-id="{c["creative_id"]}">
            <div class="item-header">
                <span class="creative-id">{c["creative_id"]}</span>
                <span class="badge {badge_class}">{c["status"]}</span>
            </div>
            <h3>{c["headline"]}</h3>
            <div class="item-meta">
                <span>Platform: {c["platform"]}</span>
                <span>Campaign: {c["campaign_name"]}</span>
            </div>
            <button class="view-detail" onclick="openDetail('{c["creative_id"]}')">View Details</button>
        </div>
        """
    return items_html


def build_creative_detail_html(creative):
    badge_class = creative["status"].lower()
    return f"""
    <div class="detail-overlay" id="detail-overlay">
        <div class="detail-content">
            <div class="detail-header">
                <h2>{creative["creative_id"]}: {creative["headline"]}</h2>
                <span class="badge {badge_class}">{creative["status"]}</span>
                <button class="close-btn" onclick="closeDetail()">&times;</button>
            </div>
            <table class="detail-table">
                <tr><td>creative_id</td><td>{creative["creative_id"]}</td></tr>
                <tr><td>status</td><td>{creative["status"]}</td></tr>
                <tr><td>headline</td><td>{creative["headline"]}</td></tr>
                <tr><td>campaign_name</td><td>{creative["campaign_name"]}</td></tr>
                <tr><td>start_date</td><td>{creative["start_date"]}</td></tr>
                <tr><td>end_date</td><td>{creative["end_date"]}</td></tr>
                <tr><td>platform</td><td>{creative["platform"]}</td></tr>
            </table>
            <p class="description">{creative["description"]}</p>
        </div>
    </div>
    """


HTML_STYLE = """
<style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; }
    .header { background: #1a1a2e; color: white; padding: 20px 40px; }
    .header h1 { font-size: 24px; margin-bottom: 10px; }
    .search-bar { display: flex; gap: 10px; margin: 20px 40px; }
    .search-bar input { flex: 1; padding: 10px 16px; font-size: 16px; border: 2px solid #ddd; border-radius: 6px; }
    .search-bar button { padding: 10px 24px; font-size: 16px; background: #1a1a2e; color: white; border: none; border-radius: 6px; cursor: pointer; }
    .search-bar button:hover { background: #16213e; }
    .feed { max-width: 800px; margin: 0 auto 40px; padding: 0 20px; }
    .feed-item { background: white; border-radius: 8px; padding: 20px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .feed-item .item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .creative-id { font-size: 13px; color: #888; font-weight: 600; }
    .feed-item h3 { font-size: 18px; margin-bottom: 8px; color: #1a1a2e; }
    .item-meta { display: flex; gap: 20px; font-size: 14px; color: #666; margin-bottom: 12px; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .badge.current { background: #d4edda; color: #155724; }
    .badge.paused { background: #fff3cd; color: #856404; }
    .badge.archived { background: #f8d7da; color: #721c24; }
    .view-detail { padding: 8px 16px; font-size: 14px; background: #0f3460; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .view-detail:hover { background: #16213e; }
    .detail-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1000; justify-content: center; align-items: center; }
    .detail-overlay.active { display: flex; }
    .detail-content { background: white; border-radius: 12px; padding: 30px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative; }
    .detail-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
    .detail-header h2 { font-size: 20px; flex: 1; }
    .close-btn { position: absolute; top: 15px; right: 20px; font-size: 28px; background: none; border: none; cursor: pointer; color: #999; }
    .close-btn:hover { color: #333; }
    .detail-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .detail-table td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    .detail-table td:first-child { font-weight: 700; color: #555; width: 40%; }
    .description { color: #555; line-height: 1.6; }
    .load-more { text-align: center; padding: 20px; }
    .load-more button { padding: 12px 32px; font-size: 16px; background: #e94560; color: white; border: none; border-radius: 6px; cursor: pointer; }
    .load-more button:hover { background: #c73e54; }
    .no-results { text-align: center; padding: 40px; color: #999; font-size: 18px; }
    .feed-info { text-align: center; color: #888; padding: 10px; font-size: 14px; }
</style>
"""

HTML_SCRIPT = """
<script>
    let currentPage = 1;
    let totalPages = 3;
    let currentBrand = '';

    function search() {
        currentBrand = document.getElementById('brand-input').value.trim();
        if (!currentBrand) return;
        currentPage = 1;
        document.getElementById('feed').innerHTML = '';
        loadPage(currentPage);
    }

    async function loadPage(page) {
        const resp = await fetch('/api/search?brand=' + encodeURIComponent(currentBrand) + '&page=' + page);
        const data = await resp.json();
        if (data.items && data.items.length > 0) {
            renderItems(data.items);
            document.getElementById('feed-info').textContent = 'Showing page ' + page + ' of ' + totalPages;
        }
        if (page >= data.total_pages || !data.items || data.items.length === 0) {
            document.getElementById('load-more-btn').style.display = 'none';
        } else {
            document.getElementById('load-more-btn').style.display = 'block';
            document.getElementById('load-more-btn').onclick = () => loadPage(page + 1);
        }
        currentPage = page;
    }

    function renderItems(items) {
        const feed = document.getElementById('feed');
        items.forEach(item => {
            const div = document.createElement('div');
            div.className = 'feed-item';
            div.setAttribute('data-creative-id', item.creative_id);
            div.innerHTML = `
                <div class="item-header">
                    <span class="creative-id">${item.creative_id}</span>
                    <span class="badge ${item.status.toLowerCase()}">${item.status}</span>
                </div>
                <h3>${item.headline}</h3>
                <div class="item-meta">
                    <span>Platform: ${item.platform}</span>
                    <span>Campaign: ${item.campaign_name}</span>
                </div>
                <button class="view-detail" onclick="openDetail('${item.creative_id}')">View Details</button>
            `;
            feed.appendChild(div);
        });
    }

    async function openDetail(creativeId) {
        const resp = await fetch('/creative/' + creativeId);
        const html = await resp.text();
        const overlay = document.getElementById('detail-overlay-container');
        overlay.innerHTML = html;
        document.getElementById('detail-overlay').classList.add('active');
    }

    function closeDetail() {
        const overlay = document.getElementById('detail-overlay');
        if (overlay) overlay.classList.remove('active');
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDetail();
    });
</script>
"""


class BrandAdHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        if path == "/health":
            self._json({"ok": True})
        elif path == "/api/search":
            self._api_search(params)
        elif path.startswith("/creative/"):
            creative_id = path.split("/creative/")[1]
            self._creative_detail(creative_id)
        elif path == "/":
            self._index()
        else:
            self._404()

    def _json(self, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, body, status=200):
        data = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", len(data))
        self.end_headers()
        self.wfile.write(data)

    def _404(self):
        self._html("<h1>404 Not Found</h1>", 404)

    def _index(self):
        body = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>BrandAd Library</title>
    {HTML_STYLE}
</head>
<body>
    <div class="header">
        <h1>BrandAd Library</h1>
        <p>Browse and manage creative advertisements</p>
    </div>
    <div class="search-bar">
        <input type="text" id="brand-input" placeholder="Enter brand name (e.g., NovaLume)..." value="NovaLume">
        <button onclick="search()">Search</button>
    </div>
    <div class="feed-info" id="feed-info">Enter a brand name and click Search to begin.</div>
    <div class="feed" id="feed"></div>
    <div class="load-more">
        <button id="load-more-btn" style="display:none">Load More</button>
    </div>
    <div id="detail-overlay-container"></div>
    {HTML_SCRIPT}
</body>
</html>"""
        self._html(body)

    def _api_search(self, params):
        brand = params.get("brand", [""])[0].strip()
        page = int(params.get("page", ["1"])[0])

        if not brand:
            self._json({"items": [], "total_pages": 0, "page": page})
            return

        # All creatives match "NovaLume" brand search
        page_ids = FEED_PAGES.get(page, [])
        items = []
        seen = set()
        for cid in page_ids:
            c = get_creative(cid)
            if c and cid not in seen:
                items.append(
                    {
                        "creative_id": c["creative_id"],
                        "headline": c["headline"],
                        "status": c["status"],
                        "campaign_name": c["campaign_name"],
                        "platform": c["platform"],
                    }
                )
                seen.add(cid)

        self._json(
            {
                "items": items,
                "total_pages": len(FEED_PAGES),
                "page": page,
                "brand": brand,
            }
        )

    def _creative_detail(self, creative_id):
        creative = get_creative(creative_id)
        if creative is None:
            self._html("<h1>Creative Not Found</h1>", 404)
            return

        detail_html = build_creative_detail_html(creative)
        self._html(detail_html)


if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), BrandAdHandler)
    print(f"BrandAd Library running on http://0.0.0.0:{PORT}")
    server.serve_forever()
