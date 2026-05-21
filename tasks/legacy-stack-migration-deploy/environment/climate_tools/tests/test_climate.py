#!/usr/bin/env python3
"""Unit tests for climate_tools."""

import pytest


def test_analyze_temperature_basic():
    from climate_tools import analyze_temperature

    result = analyze_temperature([20, 22, 19, 25, 23])
    assert result["count"] == 5
    assert result["min"] == 19
    assert result["max"] == 25
    assert result["range"] == 6
    # Mean should be 21.8 (float division)
    assert abs(result["mean"] - 21.8) < 0.01


def test_analyze_temperature_single():
    from climate_tools import analyze_temperature

    result = analyze_temperature([15])
    assert result["count"] == 1
    assert result["mean"] == 15
    assert result["range"] == 0


def test_analyze_temperature_empty():
    from climate_tools import analyze_temperature

    with pytest.raises(ValueError):
        analyze_temperature([])


def test_categorize_readings():
    from climate_tools import categorize_readings

    readings = {"A": 5, "B": 15, "C": 30, "D": 8, "E": 22}
    result = categorize_readings(readings)
    assert set(result["cold"]) == {"A", "D"}
    assert set(result["warm"]) == {"B", "E"}
    assert set(result["hot"]) == {"C"}


def test_compute_anomalies():
    from climate_tools import compute_anomalies

    anomalies = compute_anomalies([20, 22, 18], 20.0)
    assert anomalies == [0.0, 2.0, -2.0]


def test_format_report():
    from climate_tools import format_report

    data = {"mean": 21.5, "count": 10}
    report = format_report(data)
    assert "Climate Analysis Report" in report
    assert "mean" in report
    assert "21.5" in report


def test_moving_average():
    from climate_tools import moving_average

    result = moving_average([10, 20, 30, 40, 50], window=3)
    assert len(result) == 3
    assert abs(result[0] - 20.0) < 0.01
    assert abs(result[1] - 30.0) < 0.01
    assert abs(result[2] - 40.0) < 0.01


def test_moving_average_too_short():
    from climate_tools import moving_average

    with pytest.raises(ValueError):
        moving_average([10, 20], window=3)


def test_detect_extremes():
    from climate_tools import detect_extremes

    temps = [-15, 10, 20, 42, 5, -12, 38, 41]
    result = detect_extremes(temps)
    assert len(result["extreme_cold"]) == 2
    assert len(result["extreme_hot"]) == 2
