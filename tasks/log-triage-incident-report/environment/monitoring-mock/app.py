"""Monitoring Dashboard Mock — shows error rate graph at port 3000."""

from flask import Flask

app = Flask(__name__)


@app.route("/")
def index():
    return """<!DOCTYPE html>
<html>
<head><title>System Monitor</title></head>
<body>
<h1>System Monitoring Dashboard</h1>
<h2>Error Rate — Last 1 Hour</h2>
<pre style="background:#1a1a2e;color:#0f0;padding:20px;font-family:monospace;font-size:14px;">
Time            | Nginx 5xx | App Errors | DB Errors | Error Rate
----------------|-----------|------------|-----------|----------
14:00 - 14:10   |     0     |     0      |     0     |   0.0%
14:10 - 14:20   |     0     |     0      |     0     |   0.0%
14:20 - 14:25   |     0     |     0      |     3     |   0.1%
14:25 - 14:30   |     2     |     8      |    12     |   2.3%
14:30 - 14:35   |    15     |    42      |    38     |  12.7%
14:35 - 14:40   |    47     |    89      |    65     |  28.4%
14:40 - 14:45   |    92     |   156      |    78     |  45.2%
14:45 - 14:50   |   134     |   201      |    82     |  58.1%
14:50 - 14:55   |   145     |   215      |    85     |  61.3%
14:55 - 15:00   |   148     |   218      |    86     |  62.0%
</pre>
<h3>Alert: Error rate exceeded 50% threshold at 14:45</h3>
<p style="color:red;font-weight:bold;">
⚠ CRITICAL: Service degradation detected. Multiple services affected.
DB connection errors started at ~14:20, cascading failures observed.
</p>
<h3>Service Status</h3>
<ul>
<li>Nginx: <span style="color:red;">DEGRADED</span> — 62% 5xx responses</li>
<li>App Server: <span style="color:red;">DEGRADED</span> — connection pool exhausted</li>
<li>Database: <span style="color:orange;">WARNING</span> — max_connections reached</li>
</ul>
</body>
</html>"""


@app.route("/api/metrics")
def metrics():
    return {
        "nginx_5xx_rate": 0.62,
        "app_error_rate": 0.58,
        "db_connection_usage": 1.0,
        "alert_status": "critical",
        "first_anomaly": "14:20",
        "escalation_time": "14:30",
    }


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000)
