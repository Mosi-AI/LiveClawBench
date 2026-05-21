#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""climate_tools — Climate analysis library."""

import urllib2  # used by fetch_station_data


def fetch_station_data(url, cache_path):
    """Fetch station readings from an HTTP endpoint and cache the payload.

    Reads the cached payload as binary, then concatenates a text header in front of it
    before returning — this silently broke under Python 3.
    """
    resp = urllib2.urlopen(url)
    payload = resp.read()

    f = open(cache_path, "rb")
    existing = f.read()
    f.close()

    header = "# station data — fetched\n"
    return header + existing + payload


def analyze_temperature(temps):
    """Analyze a list of temperature readings.
    Returns a dict with mean, min, max, range.
    """
    print "Analyzing %d temperature readings..." % len(temps)

    if not temps:
        raise ValueError, "Temperature list cannot be empty"

    total = 0
    for t in temps:
        total = total + t

    mean = total / len(temps)

    result = {
        "mean": mean,
        "min": min(temps),
        "max": max(temps),
        "range": max(temps) - min(temps),
        "count": len(temps),
    }

    if result.has_key("mean"):
        print "Mean temperature: %s" % result["mean"]

    return result


def categorize_readings(readings):
    """Categorize temperature readings into cold/warm/hot buckets.

    Args:
        readings: dict mapping station_id -> temperature

    Returns:
        dict with 'cold', 'warm', 'hot' lists of station IDs
    """
    categories = {"cold": [], "warm": [], "hot": []}

    for station, temp in readings.iteritems():
        if temp < 10:
            categories["cold"].append(station)
        elif temp < 25:
            categories["warm"].append(station)
        else:
            categories["hot"].append(station)

    print "Categorized %d stations" % len(readings)
    return categories


def compute_anomalies(temps, baseline):
    """Compute temperature anomalies relative to baseline.

    Args:
        temps: list of temperature values
        baseline: reference temperature (float)

    Returns:
        list of anomaly values (temp - baseline)
    """
    anomalies = []
    for i in xrange(len(temps)):
        anomaly = temps[i] - baseline
        anomalies.append(anomaly)

    print "Computed %d anomalies (baseline=%.1f)" % (len(anomalies), baseline)
    return anomalies


def format_report(data):
    """Format analysis data as a human-readable report string."""
    header = unicode("=== Climate Analysis Report ===\n")
    lines = [header]

    for key, value in data.iteritems():
        line = unicode("  %s: %s\n" % (key, value))
        lines.append(line)

    return u"".join(lines)


def moving_average(temps, window=3):
    """Compute moving average with given window size.

    Args:
        temps: list of temperature values
        window: window size (default 3)

    Returns:
        list of moving averages (shorter than input by window-1)
    """
    if len(temps) < window:
        raise ValueError, "Not enough data points for window size %d" % window

    result = []
    for i in xrange(len(temps) - window + 1):
        avg = sum(temps[i:i + window]) / window
        result.append(avg)

    print "Computed moving average (window=%d): %d values" % (window, len(result))
    return result


def detect_extremes(temps, threshold_low=-10, threshold_high=40):
    """Detect extreme temperature events.

    Returns dict with 'extreme_cold' and 'extreme_hot' lists of (index, value) tuples.
    """
    extremes = {"extreme_cold": [], "extreme_hot": []}

    for i in xrange(len(temps)):
        if temps[i] <= threshold_low:
            extremes["extreme_cold"].append((i, temps[i]))
        elif temps[i] >= threshold_high:
            extremes["extreme_hot"].append((i, temps[i]))

    total = len(extremes["extreme_cold"]) + len(extremes["extreme_hot"])
    print "Found %d extreme events" % total
    return extremes


def export_readings(temps, filepath):
    """Export temperature readings to a CSV file.

    Args:
        temps: list of temperature values
        filepath: path to output CSV file
    """
    f = open(filepath, "w")
    f.write("index,temperature\n")
    for i in xrange(len(temps)):
        f.write("%d,%.2f\n" % (i, temps[i]))
    f.close()
    print "Exported %d readings to %s" % (len(temps), filepath)


def sort_readings(readings, reverse=False):
    """Sort temperature readings by value.

    Args:
        readings: list of (station_id, temperature) tuples
        reverse: if True, sort descending

    Returns:
        sorted list of tuples
    """
    return sorted(readings, cmp=lambda a, b: cmp(a[1], b[1]), reverse=reverse)
