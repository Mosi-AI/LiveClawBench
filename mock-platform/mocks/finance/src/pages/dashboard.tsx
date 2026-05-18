/** @jsxImportSource hono/jsx */
import { Layout } from "../components/layout";
import { renderLineChart, renderBarChart } from "../components/svg-chart";

export function DashboardPage({
  config,
  kpis,
  monthly,
  isAdmin,
}: {
  config: { date_range_start: string; date_range_end: string; formula_json: string; department_weight_json: string };
  kpis: { revenue: number; expense: number; profit: number };
  monthly: Array<{ month: string; revenue: number; expense: number; profit: number }>;
  isAdmin: boolean;
}) {
  const lineData = monthly.map((m) => ({ label: m.month, value: m.revenue }));
  const barData = monthly.map((m) => ({
    label: m.month,
    series: { revenue: m.revenue, expense: m.expense, profit: m.profit },
  }));
  const barColors = { revenue: "#22c55e", expense: "#ef4444", profit: "#3b82f6" };

  return (
    <Layout title="Dashboard">
      <h2>Dashboard</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
        <div style="background:#f0fdf4;padding:16px;border-radius:8px;">
          <div style="font-size:12px;color:#166534;">Revenue</div>
          <div style="font-size:24px;font-weight:bold;color:#15803d;">{kpis.revenue.toLocaleString()}</div>
        </div>
        <div style="background:#fef2f2;padding:16px;border-radius:8px;">
          <div style="font-size:12px;color:#991b1b;">Expense</div>
          <div style="font-size:24px;font-weight:bold;color:#b91c1c;">{kpis.expense.toLocaleString()}</div>
        </div>
        <div style="background:#eff6ff;padding:16px;border-radius:8px;">
          <div style="font-size:12px;color:#1e40af;">Profit</div>
          <div style="font-size:24px;font-weight:bold;color:#1d4ed8;">{kpis.profit.toLocaleString()}</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div>
          <h3>Revenue Trend</h3>
          {renderLineChart({ data: lineData, options: { width: 400, height: 250, title: "Revenue Trend" } })}
        </div>
        <div>
          <h3>P&amp;L Breakdown</h3>
          {renderBarChart({ data: barData, options: { width: 400, height: 250, colors: barColors } })}
        </div>
      </div>

      <h3>Monthly Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        <thead>
          <tr style="background:#f8f9fa;border-bottom:2px solid #dee2e6;">
            <th style="padding:10px;text-align:left;">Month</th>
            <th style="padding:10px;text-align:right;">Revenue</th>
            <th style="padding:10px;text-align:right;">Expense</th>
            <th style="padding:10px;text-align:right;">Profit</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((m) => (
            <tr key={m.month} style="border-bottom:1px solid #e9ecef;">
              <td style="padding:10px;">{m.month}</td>
              <td style="padding:10px;text-align:right;">{m.revenue.toLocaleString()}</td>
              <td style="padding:10px;text-align:right;">{m.expense.toLocaleString()}</td>
              <td style="padding:10px;text-align:right;">{m.profit.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {isAdmin && (
        <div style="border-top:2px solid #dee2e6;padding-top:24px;">
          <h3>Admin Configuration</h3>
          <form method="POST" action="/api/dashboard/config" style="max-width:600px;">
            <div style="margin-bottom:12px;">
              <label>Date Range</label>
              <div style="display:flex;gap:8px;margin-top:4px;">
                <input type="date" name="date_range_start" value={config.date_range_start} required style="flex:1;padding:8px;" />
                <input type="date" name="date_range_end" value={config.date_range_end} required style="flex:1;padding:8px;" />
              </div>
            </div>
            <div style="margin-bottom:12px;">
              <label>Formula JSON</label>
              <textarea name="formula_json" rows="6" style="width:100%;padding:8px;margin-top:4px;font-family:monospace;">{config.formula_json}</textarea>
            </div>
            <div style="margin-bottom:12px;">
              <label>Department Weights JSON</label>
              <textarea name="department_weight_json" rows="3" style="width:100%;padding:8px;margin-top:4px;font-family:monospace;">{config.department_weight_json}</textarea>
            </div>
            <button type="submit" style="padding:10px 20px;background:#2c3e50;color:white;border:none;border-radius:4px;cursor:pointer;">Save Configuration</button>
          </form>
        </div>
      )}
    </Layout>
  );
}
