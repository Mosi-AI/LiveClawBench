/** @jsxImportSource hono/jsx */

export function renderLineChart({
  data,
  options,
}: {
  data: Array<{ label: string; value: number }>;
  options: { width: number; height: number; title?: string };
}) {
  const { width, height, title } = options;
  const padding = 40;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  if (data.length === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <title>{title || "Line Chart"}</title>
        <desc>No data available</desc>
        <text x={width / 2} y={height / 2} text-anchor="middle" fill="#999">No data</text>
      </svg>
    );
  }

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal === minVal ? 1 : maxVal - minVal;
  const yScale = (v: number) => chartH - ((v - minVal) / range) * chartH + padding;
  const xScale = (i: number) => (i / (data.length - 1 || 1)) * chartW + padding;
  const points = data.map((d, i) => `${xScale(i)},${yScale(d.value)}`).join(" ");
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const v = minVal + (range * i) / tickCount;
    return { y: yScale(v), label: String(Math.round(v)) };
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <title>{title || "Line Chart"}</title>
      <desc>Line chart with {data.length} data points</desc>
      {ticks.map((t, i) => (
        <line key={`g${i}`} x1={padding} y1={t.y} x2={width - padding} y2={t.y} stroke="#e5e7eb" stroke-dasharray="4,4" />
      ))}
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#374151" stroke-width="2" />
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#374151" stroke-width="2" />
      <polyline fill="none" stroke="#3b82f6" stroke-width="2" points={points} />
      {data.map((d, i) => (
        <circle key={`p${i}`} cx={xScale(i)} cy={yScale(d.value)} r="4" fill="#3b82f6" />
      ))}
      {ticks.map((t, i) => (
        <text key={`yt${i}`} x={padding - 5} y={t.y + 4} text-anchor="end" font-size="10" fill="#6b7280">{t.label}</text>
      ))}
      {data.map((d, i) => (
        <text key={`xt${i}`} x={xScale(i)} y={height - padding + 15} text-anchor="middle" font-size="10" fill="#6b7280">{d.label}</text>
      ))}
    </svg>
  );
}

export function renderBarChart({
  data,
  options,
}: {
  data: Array<{ label: string; series: Record<string, number> }>;
  options: { width: number; height: number; colors: Record<string, string> };
}) {
  const { width, height, colors } = options;
  const padding = 40;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  if (data.length === 0) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <title>Bar Chart</title>
        <desc>No data available</desc>
        <text x={width / 2} y={height / 2} text-anchor="middle" fill="#999">No data</text>
      </svg>
    );
  }

  const seriesKeys = Object.keys(data[0].series);
  const allValues = data.flatMap((d) => Object.values(d.series));
  const minVal = Math.min(0, ...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal === minVal ? 1 : maxVal - minVal;
  const yScale = (v: number) => chartH - ((v - minVal) / range) * chartH + padding;
  const zeroY = yScale(0);
  const groupW = chartW / data.length;
  const barW = groupW / (seriesKeys.length + 1);
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const v = minVal + (range * i) / tickCount;
    return { y: yScale(v), label: String(Math.round(v)) };
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <title>Bar Chart</title>
      <desc>Bar chart with {seriesKeys.length} series</desc>
      {ticks.map((t, i) => (
        <line key={`g${i}`} x1={padding} y1={t.y} x2={width - padding} y2={t.y} stroke="#e5e7eb" stroke-dasharray="4,4" />
      ))}
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#374151" stroke-width="2" />
      <line x1={padding} y1={zeroY} x2={width - padding} y2={zeroY} stroke="#374151" stroke-width="2" />
      {data.map((d, gi) =>
        seriesKeys.map((key, si) => {
          const val = d.series[key];
          const barH = Math.abs(zeroY - yScale(val));
          const x = padding + gi * groupW + (si + 0.5) * barW;
          const y = val >= 0 ? yScale(val) : zeroY;
          return <rect key={`b${gi}-${si}`} x={x} y={y} width={barW * 0.8} height={barH} fill={colors[key] || "#3b82f6"} />;
        })
      )}
      {ticks.map((t, i) => (
        <text key={`yt${i}`} x={padding - 5} y={t.y + 4} text-anchor="end" font-size="10" fill="#6b7280">{t.label}</text>
      ))}
      {data.map((d, i) => (
        <text key={`xt${i}`} x={padding + i * groupW + groupW / 2} y={height - padding + 15} text-anchor="middle" font-size="10" fill="#6b7280">{d.label}</text>
      ))}
      {seriesKeys.map((key, i) => (
        <g key={`l${i}`}>
          <rect x={width - padding - 80} y={padding + i * 16} width="10" height="10" fill={colors[key] || "#3b82f6"} />
          <text x={width - padding - 65} y={padding + i * 16 + 9} font-size="10" fill="#374151">{key}</text>
        </g>
      ))}
    </svg>
  );
}
