#!/usr/bin/env python3
"""
Generate realistic log files for the log-triage-incident-report task.

Root cause chain:
1. 14:20 — A long-running analytics query starts in PostgreSQL, holding connections
2. 14:25 — DB connection pool fills up (max_connections = 50 reached)
3. 14:28 — App server starts getting connection timeouts from DB
4. 14:30 — Nginx starts returning 502 Bad Gateway as app server fails
5. 14:35+ — Cascading failure: more retries = more connections = worse

Distraction errors (not root cause):
- Occasional 404s in Nginx (normal)
- App server WARNING about deprecated API usage (irrelevant)
- DB NOTICE about table not analyzed (routine maintenance)
"""

import os
import random

random.seed(42)

LOG_DIR = "/workspace/logs"
os.makedirs(LOG_DIR, exist_ok=True)


# Helper to generate IPs
def random_ip():
    return f"10.0.{random.randint(1, 5)}.{random.randint(10, 250)}"


# ============ DATABASE LOG ============
db_lines = []

# Normal operations 14:00-14:19
for minute in range(0, 20):
    ts = f"2026-04-12 14:{minute:02d}:{random.randint(0, 59):02d}"
    db_lines.append(
        f"{ts} UTC [pid={random.randint(1000, 9999)}] LOG:  statement: SELECT * FROM users WHERE id = {random.randint(1, 1000)}"
    )
    if minute % 5 == 0:
        db_lines.append(
            f'{ts} UTC [pid={random.randint(1000, 9999)}] NOTICE:  table "sessions" was not analyzed recently'
        )  # distraction

# 14:20 — ROOT CAUSE: slow analytics query
db_lines.append(
    "2026-04-12 14:20:03 UTC [pid=5432] LOG:  statement: SELECT user_id, COUNT(*) as cnt, AVG(amount) as avg_amount FROM transactions GROUP BY user_id HAVING COUNT(*) > 100 ORDER BY avg_amount DESC"
)
db_lines.append(
    "2026-04-12 14:20:03 UTC [pid=5432] LOG:  duration: query started, estimated rows: 15000000"
)

# 14:20-14:25 — connections accumulating
for i in range(15):
    ts = f"2026-04-12 14:{20 + i // 5:02d}:{(i * 20) % 60:02d}"
    pid = 5500 + i
    db_lines.append(
        f"{ts} UTC [pid={pid}] LOG:  connection received: host=10.0.1.100 port={5000 + i}"
    )
    db_lines.append(
        f"{ts} UTC [pid={pid}] LOG:  connection authorized: user=appuser database=webapp"
    )

# 14:25 — max_connections reached
db_lines.append(
    "2026-04-12 14:25:01 UTC [pid=5432] LOG:  duration: 300012.345 ms  statement: SELECT user_id, COUNT(*) as cnt, AVG(amount) as avg_amount FROM transactions GROUP BY user_id HAVING COUNT(*) > 100 ORDER BY avg_amount DESC"
)
db_lines.append(
    "2026-04-12 14:25:15 UTC FATAL:  sorry, too many clients already (max_connections = 50)"
)
db_lines.append(
    "2026-04-12 14:25:15 UTC DETAIL:  There are already 50 connections, and max_connections is 50."
)
db_lines.append(
    "2026-04-12 14:25:15 UTC HINT:  Increase max_connections or close idle connections."
)

# 14:25-15:00 — repeated connection rejections
for minute in range(25, 60):
    for _ in range(random.randint(2, 8)):
        ts = f"2026-04-12 14:{minute:02d}:{random.randint(0, 59):02d}"
        db_lines.append(
            f"{ts} UTC FATAL:  sorry, too many clients already (max_connections = 50)"
        )
    # Some connections closing and reopening
    if minute % 3 == 0:
        ts = f"2026-04-12 14:{minute:02d}:30"
        db_lines.append(
            f"{ts} UTC [pid={random.randint(5000, 6000)}] LOG:  disconnection: session time: 0:0{random.randint(1, 9)}:0{random.randint(0, 9)}.{random.randint(100, 999)} user=appuser database=webapp"
        )

# ---- Noise: scheduled vacuum notices ----
for _ in range(110):
    minute = random.randint(0, 59)
    ts = f"2026-04-12 14:{minute:02d}:{random.randint(0, 59):02d}"
    tbl = random.choice(
        ["sessions", "transactions", "users", "audit_log", "cache_entries"]
    )
    db_lines.append(
        f'{ts} UTC [pid={random.randint(1000, 9999)}] NOTICE:  db vacuum scheduled for relation "public.{tbl}" at next off-peak window'
    )

with open(os.path.join(LOG_DIR, "database.log"), "w") as f:
    f.write("\n".join(db_lines) + "\n")


# ============ APP SERVER LOG ============
app_lines = []

# Normal operations 14:00-14:27
for minute in range(0, 28):
    ts = f"2026-04-12 14:{minute:02d}:{random.randint(0, 59):02d}"
    app_lines.append(
        f"[{ts}] INFO  werkzeug: {random_ip()} - GET /api/users HTTP/1.1 200 - {random.randint(5, 50)}ms"
    )
    if minute % 7 == 0:
        app_lines.append(
            f"[{ts}] WARNING deprecated_api: Client using deprecated endpoint /api/v1/users (should use /api/v2/users)"
        )  # distraction
    if minute % 10 == 0:
        app_lines.append(
            f"[{ts}] INFO  cache: Cache hit ratio: {random.randint(85, 99)}%"
        )

# 14:28 — first DB timeout errors
app_lines.append(
    "[2026-04-12 14:28:05] ERROR   sqlalchemy.pool: Connection to database timed out after 30 seconds"
)
app_lines.append(
    "[2026-04-12 14:28:05] ERROR   sqlalchemy.pool: QueuePool limit of 10 reached, connection timed out, timeout 30"
)
app_lines.append(
    "[2026-04-12 14:28:06] WARNING app.db: Retrying database connection (attempt 1/3)"
)
app_lines.append(
    "[2026-04-12 14:28:36] ERROR   app.db: Retrying database connection (attempt 2/3)"
)
app_lines.append(
    "[2026-04-12 14:29:06] ERROR   app.db: All retry attempts failed. Database unavailable."
)

# 14:30-15:00 — cascading failures
for minute in range(30, 60):
    for req in range(random.randint(5, 20)):
        ts = f"2026-04-12 14:{minute:02d}:{random.randint(0, 59):02d}"
        if random.random() < 0.7:  # 70% fail
            app_lines.append(
                f"[{ts}] ERROR   werkzeug: {random_ip()} - GET /api/users HTTP/1.1 500 - {random.randint(30000, 31000)}ms"
            )
            app_lines.append(
                f"[{ts}] ERROR   sqlalchemy.pool: Connection to database timed out after 30 seconds"
            )
        else:
            app_lines.append(
                f"[{ts}] INFO  werkzeug: {random_ip()} - GET /api/status HTTP/1.1 200 - {random.randint(2, 10)}ms"
            )

    if minute % 5 == 0:
        app_lines.append(
            f"[2026-04-12 14:{minute:02d}:00] CRITICAL app.health: Health check failed: database connection pool exhausted"
        )
        app_lines.append(
            f"[2026-04-12 14:{minute:02d}:00] ERROR   app.pool: Active connections: 10/10, Waiting: {random.randint(20, 80)}"
        )

# ---- Noise injection: deprecation warnings, 404 favicon errors ----
# Spread across the whole 14:00-14:59 window so they interleave with real signals.
for _ in range(520):
    minute = random.randint(0, 59)
    ts = f"2026-04-12 14:{minute:02d}:{random.randint(0, 59):02d}"
    pkg = random.choice(
        [
            "flask_sqlalchemy.ext",
            "werkzeug.routing",
            "app.helpers",
            "pytz.tzinfo",
            "sqlalchemy.orm.query",
        ]
    )
    sym = random.choice(
        [
            "BaseQuery.paginate",
            "url_map.Rule.match",
            "lazy_property",
            "normalize_timezone",
            "Session.query_property",
        ]
    )
    app_lines.append(
        f"[{ts}] WARN  deprecation: {pkg}.{sym} is deprecated and will be removed in a future release"
    )

for _ in range(230):
    minute = random.randint(0, 59)
    ts = f"2026-04-12 14:{minute:02d}:{random.randint(0, 59):02d}"
    app_lines.append(
        f"[{ts}] ERROR   werkzeug: {random_ip()} - GET /favicon.ico HTTP/1.1 404 - 2ms"
    )

# ---- Late-arriving FATAL that looks like root cause but is actually a symptom ----
# The real root cause fires at 14:20 (analytics query in database.log); this FATAL at 14:37
# is downstream of pool exhaustion. Time-sorted triage will land on it first.
app_lines.append(
    "[2026-04-12 14:37:42] FATAL   app.core: connection refused — upstream DB unreachable; giving up"
)
app_lines.append(
    "[2026-04-12 14:38:00] FATAL   app.core: connection refused — upstream DB unreachable; giving up"
)
app_lines.append(
    "[2026-04-12 14:38:15] FATAL   app.core: connection refused — upstream DB unreachable; giving up"
)

with open(os.path.join(LOG_DIR, "app_server.log"), "w") as f:
    f.write("\n".join(app_lines) + "\n")


# ============ NGINX ACCESS LOG ============
nginx_access = []
nginx_error = []

# Normal 14:00-14:29
for minute in range(0, 30):
    for _ in range(random.randint(3, 10)):
        ts = f"12/Apr/2026:14:{minute:02d}:{random.randint(0, 59):02d} +0000"
        ip = random_ip()
        code = 200 if random.random() < 0.95 else 404  # occasional 404 (normal)
        size = random.randint(200, 5000) if code == 200 else 162
        nginx_access.append(
            f'{ip} - - [{ts}] "GET /api/users HTTP/1.1" {code} {size} "-" "Mozilla/5.0"'
        )

# 14:30 onwards — 502 flood
for minute in range(30, 60):
    for _ in range(random.randint(10, 30)):
        ts = f"12/Apr/2026:14:{minute:02d}:{random.randint(0, 59):02d} +0000"
        ip = random_ip()
        if random.random() < 0.65:  # 65% are 502s
            nginx_access.append(
                f'{ip} - - [{ts}] "GET /api/users HTTP/1.1" 502 166 "-" "Mozilla/5.0"'
            )
        elif random.random() < 0.5:
            nginx_access.append(
                f'{ip} - - [{ts}] "GET /api/users HTTP/1.1" 504 167 "-" "Mozilla/5.0"'
            )
        else:
            nginx_access.append(
                f'{ip} - - [{ts}] "GET /api/status HTTP/1.1" 200 89 "-" "Mozilla/5.0"'
            )

    # Nginx error log entries
    ts_err = f"2026/04/12 14:{minute:02d}:{random.randint(0, 59):02d}"
    nginx_error.append(
        f'{ts_err} [error] *{random.randint(100, 999)} upstream timed out (110: Connection timed out) while connecting to upstream, client: {random_ip()}, server: webapp, request: "GET /api/users HTTP/1.1", upstream: "http://127.0.0.1:5000/api/users"'
    )

# Add some distraction errors in nginx
for minute in [5, 12, 18, 22]:
    ts_err = f"2026/04/12 14:{minute:02d}:00"
    nginx_error.append(
        f"{ts_err} [warn] *{random.randint(100, 999)} an upstream response is buffered to a temporary file /var/lib/nginx/tmp/proxy_temp/{random.randint(1000, 9999)} while reading upstream"
    )

with open(os.path.join(LOG_DIR, "nginx_access.log"), "w") as f:
    f.write("\n".join(nginx_access) + "\n")

with open(os.path.join(LOG_DIR, "nginx_error.log"), "w") as f:
    f.write("\n".join(sorted(nginx_error)) + "\n")

print(
    f"Generated logs: database.log ({len(db_lines)} lines), app_server.log ({len(app_lines)} lines), nginx_access.log ({len(nginx_access)} lines), nginx_error.log ({len(nginx_error)} lines)"
)
