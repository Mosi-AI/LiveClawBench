#!/usr/bin/env bash
set -euo pipefail
echo "Reference solution for legacy-stack-migration-deploy"
echo "====================================================="

# 1. Fix PyPI server
echo "=== Fixing PyPI server ==="
mkdir -p /workspace/pypi-server/packages /workspace/pypi-server/auth

# Fix config.ini
cat > /workspace/pypi-server/config.ini << 'EOF'
[server]
port = 8080
host = 0.0.0.0

[auth]
htpasswd = /workspace/pypi-server/auth/.htpasswd

[storage]
packages_dir = /workspace/pypi-server/packages
EOF

# Create htpasswd file (no auth for simplicity)
touch /workspace/pypi-server/auth/.htpasswd

# Start PyPI server (no auth)
pypi-server run -p 8080 -i 0.0.0.0 -P . -a . /workspace/pypi-server/packages &
sleep 2

# 2. Migrate climate_tools to Python 3
echo "=== Migrating climate_tools ==="
cd /workspace/climate_tools

cat > climate_tools/__init__.py << 'PYEOF'
"""climate_tools — Climate analysis library (Python 3)."""


def analyze_temperature(temps):
    """Analyze a list of temperature readings."""
    print("Analyzing %d temperature readings..." % len(temps))
    if not temps:
        raise ValueError("Temperature list cannot be empty")

    mean = sum(temps) / len(temps)  # float division in Python 3

    result = {
        "mean": mean,
        "min": min(temps),
        "max": max(temps),
        "range": max(temps) - min(temps),
        "count": len(temps),
    }

    if "mean" in result:
        print("Mean temperature: %s" % result["mean"])

    return result


def categorize_readings(readings):
    """Categorize temperature readings into cold/warm/hot buckets."""
    categories = {"cold": [], "warm": [], "hot": []}
    for station, temp in readings.items():
        if temp < 10:
            categories["cold"].append(station)
        elif temp < 25:
            categories["warm"].append(station)
        else:
            categories["hot"].append(station)

    print("Categorized %d stations" % len(readings))
    return categories


def compute_anomalies(temps, baseline):
    """Compute temperature anomalies relative to baseline."""
    anomalies = []
    for i in range(len(temps)):
        anomaly = temps[i] - baseline
        anomalies.append(anomaly)
    print("Computed %d anomalies (baseline=%.1f)" % (len(anomalies), baseline))
    return anomalies


def format_report(data):
    """Format analysis data as a report string."""
    header = "=== Climate Analysis Report ===\n"
    lines = [header]
    for key, value in data.items():
        line = "  %s: %s\n" % (key, value)
        lines.append(line)
    return "".join(lines)


def moving_average(temps, window=3):
    """Compute moving average with given window size."""
    if len(temps) < window:
        raise ValueError("Not enough data points for window size %d" % window)

    result = []
    for i in range(len(temps) - window + 1):
        avg = sum(temps[i:i + window]) / window
        result.append(avg)
    print("Computed moving average (window=%d): %d values" % (window, len(result)))
    return result


def detect_extremes(temps, threshold_low=-10, threshold_high=40):
    """Detect extreme temperature events."""
    extremes = {"extreme_cold": [], "extreme_hot": []}
    for i in range(len(temps)):
        if temps[i] <= threshold_low:
            extremes["extreme_cold"].append((i, temps[i]))
        elif temps[i] >= threshold_high:
            extremes["extreme_hot"].append((i, temps[i]))

    total = len(extremes["extreme_cold"]) + len(extremes["extreme_hot"])
    print("Found %d extreme events" % total)
    return extremes
PYEOF

# Fix pyproject.toml
cat > pyproject.toml << 'TOMLEOF'
[build-system]
requires = ["setuptools>=64", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "climate-tools"
version = "1.0.0"
description = "Climate analysis toolkit"
requires-python = ">=3.8"
TOMLEOF

# 3. Run tests
echo "=== Running tests ==="
cd /workspace/climate_tools
pytest tests/ -v

# 4. Build and upload
echo "=== Building and uploading ==="
python3 -m build
twine upload --repository-url http://localhost:8080/ -u "" -p "" dist/*

# 5. Verify install
echo "=== Verifying installation ==="
python3 -m venv /tmp/verify_venv
/tmp/verify_venv/bin/pip install --index-url http://localhost:8080/simple/ --trusted-host localhost climate-tools
/tmp/verify_venv/bin/python3 -c "from climate_tools import analyze_temperature; print(analyze_temperature([20, 22, 19, 25, 23]))"

echo "Reference solution complete."
