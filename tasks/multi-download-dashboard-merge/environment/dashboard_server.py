"""Analytics Dashboard — mock server for multi-download-dashboard-merge task."""

import csv
import http.server
import io
import json
import urllib.parse

PORT = 8400

TRAFFIC_DATA = [
    ("2026-04-01", 1523, 1201),
    ("2026-04-02", 1487, 1156),
    ("2026-04-03", 1610, 1289),
    ("2026-04-04", 1398, 1102),
    ("2026-04-05", 1755, 1403),
]

CONVERSIONS_DATA = [
    ("2026-04-01", 45, 32),
    ("2026-04-02", 52, 38),
    ("2026-04-03", 48, 35),
    ("2026-04-04", 41, 29),
    ("2026-04-05", 63, 47),
]

SPEND_DATA = [
    ("2026-04-01", "1250.00", 890),
    ("2026-04-02", "1180.50", 845),
    ("2026-04-03", "1320.75", 920),
    ("2026-04-04", "1100.00", 780),
    ("2026-04-05", "1450.25", 1010),
]

TRAFFIC_COLS = ["Day", "Visits", "Unique Visitors"]
CONVERSIONS_COLS = ["Date", "Leads", "Signups"]
SPEND_COLS = ["report_date", "Ad Spend", "Clicks"]


def filter_data(data, start, end):
    if not start and not end:
        return data
    return [row for row in data if start <= row[0] <= end]


HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Analytics Dashboard</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #333; }
.header { background: #1a1a2e; color: white; padding: 16px 32px; }
.header h1 { font-size: 22px; }
.date-bar { background: white; padding: 12px 32px; display: flex; gap: 12px; align-items: center; border-bottom: 1px solid #ddd; }
.date-bar label { font-size: 14px; font-weight: 600; }
.date-bar input { padding: 6px 10px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; }
.date-bar button { padding: 6px 16px; font-size: 14px; background: #1a1a2e; color: white; border: none; border-radius: 4px; cursor: pointer; }
.tabs { display: flex; background: white; border-bottom: 2px solid #ddd; padding: 0 32px; }
.tab { padding: 12px 24px; cursor: pointer; font-size: 15px; font-weight: 600; color: #666; border-bottom: 3px solid transparent; margin-bottom: -2px; }
.tab:hover { color: #1a1a2e; }
.tab.active { color: #1a1a2e; border-bottom-color: #e94560; }
.content { padding: 24px 32px; }
.tab-content { display: none; }
.tab-content.active { display: block; }
table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
th { background: #1a1a2e; color: white; padding: 10px 14px; text-align: left; font-size: 13px; text-transform: uppercase; }
td { padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 14px; }
tr:last-child td { border-bottom: none; }
.export-bar { margin-top: 16px; }
.export-btn { padding: 10px 24px; font-size: 14px; background: #0f3460; color: white; border: none; border-radius: 6px; cursor: pointer; }
.export-btn:hover { background: #16213e; }
.no-data { text-align: center; padding: 40px; color: #999; font-size: 16px; }
</style>
</head>
<body>
<div class="header">
<h1>Analytics Dashboard</h1>
</div>
<div class="date-bar">
<label>Start:</label>
<input type="date" id="start-date" value="2026-04-01">
<label>End:</label>
<input type="date" id="end-date" value="2026-04-05">
<button onclick="refreshAll()">Apply Range</button>
</div>
<div class="tabs">
<div class="tab active" onclick="switchTab('traffic')">Traffic</div>
<div class="tab" onclick="switchTab('conversions')">Conversions</div>
<div class="tab" onclick="switchTab('spend')">Spend</div>
</div>
<div class="content">
<div class="tab-content active" id="tab-traffic">
<table id="table-traffic"><thead><tr><th>Day</th><th>Visits</th><th>Unique Visitors</th></tr></thead><tbody></tbody></table>
<div class="export-bar"><button class="export-btn" onclick="exportCSV('traffic')">Export CSV</button></div>
</div>
<div class="tab-content" id="tab-conversions">
<table id="table-conversions"><thead><tr><th>Date</th><th>Leads</th><th>Signups</th></tr></thead><tbody></tbody></table>
<div class="export-bar"><button class="export-btn" onclick="exportCSV('conversions')">Export CSV</button></div>
</div>
<div class="tab-content" id="tab-spend">
<table id="table-spend"><thead><tr><th>report_date</th><th>Ad Spend</th><th>Clicks</th></tr></thead><tbody></tbody></table>
<div class="export-bar"><button class="export-btn" onclick="exportCSV('spend')">Export CSV</button></div>
</div>
</div>
<script>
function switchTab(tab) {
document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
event.target.classList.add('active');
document.getElementById('tab-' + tab).classList.add('active');
}
function getRange() {
return {
start: document.getElementById('start-date').value,
end: document.getElementById('end-date').value
};
}
async function refreshAll() {
const r = getRange();
for (const tab of ['traffic', 'conversions', 'spend']) {
const resp = await fetch('/api/data/' + tab + '?start=' + r.start + '&end=' + r.end);
const data = await resp.json();
const tbody = document.querySelector('#table-' + tab + ' tbody');
tbody.innerHTML = '';
if (data.length === 0) {
tbody.innerHTML = '<tr><td colspan="99" class="no-data">No data for selected range</td></tr>';
} else {
data.forEach(row => {
const tr = document.createElement('tr');
row.forEach(val => { const td = document.createElement('td'); td.textContent = val; tr.appendChild(td); });
tbody.appendChild(tr);
});
}
}
}
function exportCSV(tab) {
const r = getRange();
window.location.href = '/api/export/' + tab + '?start=' + r.start + '&end=' + r.end;
}
refreshAll();
</script>
</body>
</html>"""


def build_json(data, columns):
    return [[str(row[i]) for i in range(len(columns))] for row in data]


def build_csv(data, columns):
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(columns)
    for row in data:
        writer.writerow(row)
    return out.getvalue()


class DashboardHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        params = urllib.parse.parse_qs(parsed.query)

        if path == "/health":
            self._json({"ok": True})
        elif path == "/":
            self._html(HTML)
        elif path.startswith("/api/data/"):
            tab = path.split("/api/data/")[1]
            self._api_data(tab, params)
        elif path.startswith("/api/export/"):
            tab = path.split("/api/export/")[1]
            self._api_export(tab, params)
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

    def _csv(self, body, filename):
        data = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", len(data))
        self.end_headers()
        self.wfile.write(data)

    def _404(self):
        self._html("<h1>404 Not Found</h1>", 404)

    def _api_data(self, tab, params):
        start = params.get("start", [""])[0]
        end = params.get("end", [""])[0]

        if tab == "traffic":
            data = filter_data(TRAFFIC_DATA, start, end)
            self._json(build_json(data, TRAFFIC_COLS))
        elif tab == "conversions":
            data = filter_data(CONVERSIONS_DATA, start, end)
            self._json(build_json(data, CONVERSIONS_COLS))
        elif tab == "spend":
            data = filter_data(SPEND_DATA, start, end)
            self._json(build_json(data, SPEND_COLS))
        else:
            self._404()

    def _api_export(self, tab, params):
        start = params.get("start", [""])[0]
        end = params.get("end", [""])[0]

        if tab == "traffic":
            data = filter_data(TRAFFIC_DATA, start, end)
            csv_body = build_csv(data, TRAFFIC_COLS)
            self._csv(csv_body, "traffic.csv")
        elif tab == "conversions":
            data = filter_data(CONVERSIONS_DATA, start, end)
            csv_body = build_csv(data, CONVERSIONS_COLS)
            self._csv(csv_body, "conversions.csv")
        elif tab == "spend":
            data = filter_data(SPEND_DATA, start, end)
            csv_body = build_csv(data, SPEND_COLS)
            self._csv(csv_body, "spend.csv")
        else:
            self._404()


if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), DashboardHandler)
    print(f"Analytics Dashboard running on http://0.0.0.0:{PORT}")
    server.serve_forever()
