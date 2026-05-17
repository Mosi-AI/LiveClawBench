import { describe, it, expect } from "bun:test";
import { renderLineChart, renderBarChart } from "../src/components/svg-chart";

describe("svg-chart", () => {
  it("renderLineChart produces valid SVG with title and desc", () => {
    const svg = renderLineChart({
      data: [
        { label: "Jan", value: 100 },
        { label: "Feb", value: 200 },
      ],
      options: { width: 400, height: 300, title: "Test Chart" },
    });
    const html = (svg as any).toString();
    expect(html).toContain("<svg");
    expect(html).toContain("</svg>");
    expect(html).toContain("<title>Test Chart</title>");
    expect(html).toContain("<desc>");
    expect(html).toContain("<polyline");
  });

  it("renderLineChart handles empty data", () => {
    const svg = renderLineChart({
      data: [],
      options: { width: 400, height: 300 },
    });
    const html = (svg as any).toString();
    expect(html).toContain("No data");
    expect(html).toContain("<title>Line Chart</title>");
  });

  it("renderLineChart handles negative values", () => {
    const svg = renderLineChart({
      data: [
        { label: "A", value: -50 },
        { label: "B", value: 50 },
      ],
      options: { width: 400, height: 300 },
    });
    const html = (svg as any).toString();
    expect(html).toContain("<svg");
  });

  it("renderBarChart produces valid SVG with legend", () => {
    const svg = renderBarChart({
      data: [
        { label: "Q1", series: { revenue: 100, expense: 80 } },
        { label: "Q2", series: { revenue: 120, expense: 90 } },
      ],
      options: { width: 400, height: 300, colors: { revenue: "#22c55e", expense: "#ef4444" } },
    });
    const html = (svg as any).toString();
    expect(html).toContain("<svg");
    expect(html).toContain("</svg>");
    expect(html).toContain("<title>Bar Chart</title>");
    expect(html).toContain("<desc>");
    expect(html).toContain("revenue");
    expect(html).toContain("expense");
  });

  it("renderBarChart handles empty data", () => {
    const svg = renderBarChart({
      data: [],
      options: { width: 400, height: 300, colors: {} },
    });
    const html = (svg as any).toString();
    expect(html).toContain("No data");
  });

  it("renderBarChart handles negative values", () => {
    const svg = renderBarChart({
      data: [
        { label: "A", series: { profit: -20 } },
        { label: "B", series: { profit: 30 } },
      ],
      options: { width: 400, height: 300, colors: { profit: "#3b82f6" } },
    });
    const html = (svg as any).toString();
    expect(html).toContain("<svg");
  });
});
