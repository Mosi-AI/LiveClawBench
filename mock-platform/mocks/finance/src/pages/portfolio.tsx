/** @jsxImportSource hono/jsx */
import { Layout } from "../components/layout";

export function PortfolioPage({ holdings, total_value, error }: { holdings: Array<{ asset_class_code: string; asset_name: string; current_value: number }>; total_value: number; error?: string }) {
  const labels: Record<string, string> = { eq: "Equities", fi: "Fixed Income", ca: "Cash", al: "Alternatives" };

  return (
    <Layout title="Portfolio">
      <h2>Portfolio Holdings</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
        <thead>
          <tr style="background:#f8f9fa;border-bottom:2px solid #dee2e6;">
            <th style="padding:10px;text-align:left;">Code</th>
            <th style="padding:10px;text-align:left;">Name</th>
            <th style="padding:10px;text-align:right;">Current Value</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => (
            <tr key={h.asset_class_code} style="border-bottom:1px solid #e9ecef;">
              <td style="padding:10px;">{h.asset_class_code.toUpperCase()}</td>
              <td style="padding:10px;">{h.asset_name || labels[h.asset_class_code]}</td>
              <td style="padding:10px;text-align:right;">{(h.current_value ?? 0).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style="font-weight:bold;border-top:2px solid #dee2e6;">
            <td colSpan={2} style="padding:10px;">Total Asset Value</td>
            <td style="padding:10px;text-align:right;">{total_value.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      {error && (
        <div style="background:#fef2f2;border:1px solid #ef4444;color:#991b1b;padding:12px 16px;border-radius:4px;margin-bottom:16px;max-width:400px;">
          {error}
        </div>
      )}
      <h3>Place Order</h3>
      <form method="POST" action="/portfolio" style="max-width:400px;">
        <div style="margin-bottom:12px;">
          <label>Asset Class</label>
          <select name="asset_class_code" required style="width:100%;padding:8px;margin-top:4px;">
            <option value="">Select...</option>
            <option value="eq">Equities (EQ)</option>
            <option value="fi">Fixed Income (FI)</option>
            <option value="ca">Cash (CA)</option>
            <option value="al">Alternatives (AL)</option>
          </select>
        </div>
        <div style="margin-bottom:12px;">
          <label>Direction</label>
          <div style="margin-top:4px;">
            <label style="margin-right:16px;"><input type="radio" name="direction" value="buy" required checked /> Buy</label>
            <label><input type="radio" name="direction" value="sell" required /> Sell</label>
          </div>
        </div>
        <div style="margin-bottom:12px;">
          <label>Amount</label>
          <input type="number" name="amount" required min="0.01" step="0.01" style="width:100%;padding:8px;margin-top:4px;" />
        </div>
        <button type="submit" style="padding:10px 20px;background:#2c3e50;color:white;border:none;border-radius:4px;cursor:pointer;">Submit Order</button>
      </form>
    </Layout>
  );
}
