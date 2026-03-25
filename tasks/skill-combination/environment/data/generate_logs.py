#!/usr/bin/env python3
"""
Generate realistic API server log files for the skill-combination benchmark.
Each day has different anomaly patterns to make the analysis interesting.
"""

import json
import random
from datetime import datetime
from pathlib import Path

random.seed(42)

SERVICES = ["api-gateway", "user-service", "order-service", "payment-service"]
ENDPOINTS = [
    "/api/v1/users", "/api/v1/orders", "/api/v1/payments",
    "/api/v1/products", "/api/v1/auth/login", "/api/v1/auth/refresh",
    "/api/v1/search", "/api/v1/notifications", "/health", "/metrics",
]
LEVELS = ["DEBUG", "INFO", "WARN", "ERROR"]
STATUS_CODES = [200, 200, 200, 200, 201, 204, 301, 400, 401, 403, 404, 500, 502, 503]

MESSAGES = {
    "DEBUG": ["Cache hit for key {key}", "Query executed in {ms}ms", "Connection pool size: {n}"],
    "INFO": ["Request processed successfully", "User authenticated", "Order created: {id}",
             "Payment processed", "Search completed: {n} results"],
    "WARN": ["Slow query detected: {ms}ms", "Rate limit approaching for IP {ip}",
             "Retry attempt {n}/3", "Connection pool near capacity: {pct}%",
             "Deprecated API version used"],
    "ERROR": ["Database connection timeout after {ms}ms", "Payment gateway unreachable",
              "Authentication service unavailable", "Internal server error: {msg}",
              "Request failed: status {code}"],
}


def gen_message(level: str) -> str:
    template = random.choice(MESSAGES[level])
    return template.format(
        key=f"user:{random.randint(1000, 9999)}",
        ms=random.randint(50, 15000),
        n=random.randint(1, 500),
        id=f"ORD-{random.randint(10000, 99999)}",
        ip=f"192.168.{random.randint(1,255)}.{random.randint(1,255)}",
        pct=random.randint(70, 99),
        msg=random.choice(["NullPointerException", "OutOfMemoryError", "StackOverflow"]),
        code=random.choice([500, 502, 503]),
    )


def gen_response_time(level: str, anomaly_factor: float = 1.0) -> int:
    """Generate response time; higher for errors, affected by anomaly factor."""
    base = {
        "DEBUG": random.randint(5, 50),
        "INFO": random.randint(20, 300),
        "WARN": random.randint(200, 2000),
        "ERROR": random.randint(1000, 10000),
    }[level]
    return int(base * anomaly_factor)


def gen_day(date: datetime, num_events: int, anomaly_config: dict) -> list:
    """Generate a day's worth of log events."""
    events = []
    for i in range(num_events):
        hour = random.randint(0, 23)
        minute = random.randint(0, 59)
        second = random.randint(0, 59)
        ts = date.replace(hour=hour, minute=minute, second=second)

        # Anomaly windows: certain hours have elevated error rates
        anomaly_factor = 1.0
        level_weights = [0.3, 0.5, 0.12, 0.08]  # DEBUG, INFO, WARN, ERROR

        for window in anomaly_config.get("windows", []):
            if window["start"] <= hour <= window["end"]:
                level_weights = window.get("weights", level_weights)
                anomaly_factor = window.get("factor", 1.0)

        level = random.choices(LEVELS, weights=level_weights, k=1)[0]
        service = random.choice(SERVICES)
        endpoint = random.choice(ENDPOINTS)
        status = random.choice(STATUS_CODES)
        if level == "ERROR":
            status = random.choice([500, 502, 503])
        elif level == "WARN":
            status = random.choice([400, 401, 403, 404, 429])

        event = {
            "timestamp": ts.strftime("%Y-%m-%dT%H:%M:%S"),
            "level": level,
            "service": service,
            "endpoint": endpoint,
            "response_time_ms": gen_response_time(level, anomaly_factor),
            "status_code": status,
            "message": gen_message(level),
        }
        events.append(event)

    events.sort(key=lambda e: e["timestamp"])
    return events


# Day configurations with different anomaly patterns
DAYS = {
    "monday": {
        "date": datetime(2026, 3, 16),
        "num_events": 850,
        "anomaly_config": {
            "windows": [
                # Morning spike: 10-11 AM, higher error rate
                {"start": 10, "end": 11, "weights": [0.1, 0.3, 0.3, 0.3], "factor": 3.0},
            ]
        },
    },
    "tuesday": {
        "date": datetime(2026, 3, 17),
        "num_events": 920,
        "anomaly_config": {
            "windows": [
                # Lunch spike: payment service overload
                {"start": 12, "end": 13, "weights": [0.05, 0.2, 0.35, 0.4], "factor": 5.0},
            ]
        },
    },
    "wednesday": {
        "date": datetime(2026, 3, 18),
        "num_events": 780,
        "anomaly_config": {
            "windows": [
                # Afternoon degradation: slow but no crashes
                {"start": 14, "end": 16, "weights": [0.15, 0.35, 0.4, 0.1], "factor": 4.0},
            ]
        },
    },
    "thursday": {
        "date": datetime(2026, 3, 19),
        "num_events": 1050,
        "anomaly_config": {
            "windows": [
                # Two separate spikes
                {"start": 9, "end": 10, "weights": [0.1, 0.2, 0.3, 0.4], "factor": 2.5},
                {"start": 15, "end": 16, "weights": [0.05, 0.15, 0.3, 0.5], "factor": 6.0},
            ]
        },
    },
}

if __name__ == "__main__":
    data_dir = Path(__file__).parent
    for day_name, cfg in DAYS.items():
        events = gen_day(cfg["date"], cfg["num_events"], cfg["anomaly_config"])
        outfile = data_dir / f"api_server_{day_name}.jsonl"
        with open(outfile, "w", encoding="utf-8") as f:
            for ev in events:
                f.write(json.dumps(ev, ensure_ascii=False) + "\n")
        print(f"Generated {len(events)} events → {outfile}")
