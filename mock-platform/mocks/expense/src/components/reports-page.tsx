/** @jsxImportSource hono/jsx */
import { Layout } from "./layout.js";
import type { FC } from "hono/jsx";
import type { SpendOverTimePoint, TopCategory, TopMerchant } from "../types.js";

interface ReportsPageProps {
  reportType: string;
  groupBy?: string;
  currency: string;
  spendOverTime?: { data: SpendOverTimePoint[]; total_spend: number; total_expenses: number };
  topCategories?: { data: TopCategory[]; total_spend: number };
  topMerchants?: { data: TopMerchant[]; total_spend: number };
}

function SpendOverTimeChart({ data }: { data: SpendOverTimePoint[] }) {
  if (data.length === 0) return <div class="empty-chart">No data to display</div>;
  const maxAmount = Math.max(...data.map((d) => d.total_amount));
  const chartWidth = 600;
  const chartHeight = 300;
  const padding = 50;
  const plotWidth = chartWidth - padding * 2;
  const plotHeight = chartHeight - padding * 2;

  const points = data.map((d, i) => ({
    x: padding + (data.length > 1 ? (i / (data.length - 1)) * plotWidth : plotWidth / 2),
    y: padding + plotHeight - (maxAmount > 0 ? (d.total_amount / maxAmount) * plotHeight : 0),
    ...d,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} class="chart-svg">
      <line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} stroke="#ddd" />
      <line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="#ddd" />
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g>
          <line x1={padding} y1={padding + plotHeight * (1 - f)} x2={chartWidth - padding} y2={padding + plotHeight * (1 - f)} stroke="#eee" />
          <text x={padding - 5} y={padding + plotHeight * (1 - f) + 4} text-anchor="end" font-size="10" fill="#999">{(maxAmount * f).toFixed(0)}</text>
        </g>
      ))}
      <path d={linePath} fill="none" stroke="#22c55e" stroke-width="2" />
      {points.map((p) => (
        <g>
          <circle cx={p.x} cy={p.y} r="4" fill="#22c55e" />
          <title>{p.period}: {p.total_amount.toFixed(2)}</title>
        </g>
      ))}
      {points.map((p, i) => (
        <text x={p.x} y={chartHeight - padding + 15} text-anchor="middle" font-size="9" fill="#666" transform={`rotate(-45, ${p.x}, ${chartHeight - padding + 15})`}>{p.period}</text>
      ))}
    </svg>
  );
}

function TopCategoriesChart({ data }: { data: TopCategory[] }) {
  if (data.length === 0) return <div class="empty-chart">No data to display</div>;
  const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];
  const maxAmount = Math.max(...data.map((d) => d.total_amount));
  const barWidth = Math.min(60, (500 - 40) / data.length - 10);

  return (
    <svg viewBox={`0 0 ${Math.max(500, data.length * (barWidth + 10) + 40)} 250`} class="chart-svg">
      {data.map((d, i) => {
        const barHeight = maxAmount > 0 ? (d.total_amount / maxAmount) * 150 : 0;
        const x = 20 + i * (barWidth + 10);
        return (
          <g>
            <rect x={x} y={200 - barHeight} width={barWidth} height={barHeight} fill={colors[i % colors.length]} />
            <text x={x + barWidth / 2} y={220} text-anchor="middle" font-size="9" fill="#666">{d.category}</text>
            <text x={x + barWidth / 2} y={195 - barHeight} text-anchor="middle" font-size="9" fill="#333">{d.percentage.toFixed(1)}%</text>
          </g>
        );
      })}
    </svg>
  );
}

function TopMerchantsChart({ data }: { data: TopMerchant[] }) {
  if (data.length === 0) return <div class="empty-chart">No data to display</div>;
  const colors = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#14b8a6", "#f97316", "#6366f1"];
  const total = data.reduce((s, d) => s + d.total_amount, 0);
  const cx = 150;
  const cy = 150;
  const r = 100;

  let currentAngle = 0;
  const slices = data.map((d, i) => {
    const angle = total > 0 ? (d.total_amount / total) * 2 * Math.PI : 0;
    const x1 = cx + r * Math.cos(currentAngle - Math.PI / 2);
    const y1 = cy + r * Math.sin(currentAngle - Math.PI / 2);
    const x2 = cx + r * Math.cos(currentAngle + angle - Math.PI / 2);
    const y2 = cy + r * Math.sin(currentAngle + angle - Math.PI / 2);
    const largeArc = angle > Math.PI ? 1 : 0;
    currentAngle += angle;
    return { ...d, path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`, color: colors[i % colors.length] };
  });

  return (
    <div class="pie-chart-container">
      <svg viewBox="0 0 300 300" class="chart-svg pie-chart">
        {slices.map((s, i) => (
          <g>
            <path d={s.path} fill={s.color} />
            <title>{s.vendor_name}: {s.percentage.toFixed(1)}%</title>
          </g>
        ))}
        <circle cx={cx} cy={cy} r={r * 0.5} fill="white" />
      </svg>
      <div class="pie-legend">
        {slices.map((s) => (
          <div class="legend-item">
            <span class="legend-color" style={`background-color: ${s.color}`}></span>
            <span class="legend-label">{s.vendor_name} ({s.percentage.toFixed(1)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyReportState() {
  return (
    <div class="empty-state">
      <div class="empty-icon">&#128202;</div>
      <h3>Nothing to show</h3>
      <p>Try adjusting your search criteria or creating something with the + button.</p>
    </div>
  );
}

export const ReportsPage: FC<ReportsPageProps> = ({ reportType, groupBy, currency, spendOverTime, topCategories, topMerchants }) => {
  const totalSpend = spendOverTime?.total_spend ?? topCategories?.total_spend ?? topMerchants?.total_spend ?? 0;
  const totalExpenses = spendOverTime?.total_expenses ?? 0;
  const hasEmptyData = spendOverTime?.data.length === 0 || topCategories?.data.length === 0 || topMerchants?.data.length === 0;

  return (
    <Layout title="Reports">
      <div class="reports-layout">
        <nav class="reports-subnav">
          <a href="/reports?type=spend-over-time" class={`subnav-item ${reportType === "spend-over-time" ? "subnav-active" : ""}`}>Spend over time</a>
          <a href="/reports?type=top-categories" class={`subnav-item ${reportType === "top-categories" ? "subnav-active" : ""}`}>Top categories</a>
          <a href="/reports?type=top-merchants" class={`subnav-item ${reportType === "top-merchants" ? "subnav-active" : ""}`}>Top merchants</a>
        </nav>
        <div class="reports-content">
          {reportType === "spend-over-time" && spendOverTime && <SpendOverTimeChart data={spendOverTime.data} />}
          {reportType === "top-categories" && topCategories && <TopCategoriesChart data={topCategories.data} />}
          {reportType === "top-merchants" && topMerchants && <TopMerchantsChart data={topMerchants.data} />}
          {hasEmptyData && <EmptyReportState />}
        </div>
        <div class="reports-footer">
          Expenses: {totalExpenses} | Total spend: {currency} {totalSpend.toFixed(2)}
        </div>
      </div>
    </Layout>
  );
};
