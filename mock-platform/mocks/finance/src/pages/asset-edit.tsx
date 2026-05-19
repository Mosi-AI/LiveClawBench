/** @jsxImportSource hono/jsx */
import { Layout } from "../components/layout";

export function AssetEditPage({ asset }: { asset: any }) {
  return (
    <Layout title={`Edit Asset ${asset.asset_name}`}>
      <h2>Edit Asset: {asset.asset_name}</h2>
      <div class="form-group" style="margin-bottom:12px;">
        <label>Cost Basis</label>
        <input type="number" id="cost_basis" value={asset.cost_basis} style="width:100%;padding:8px;" />
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label>Residual Value</label>
        <input type="number" id="residual_value" value={asset.residual_value} style="width:100%;padding:8px;" />
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label>Useful Life (years)</label>
        <input type="number" id="useful_life_years" value={asset.useful_life_years} style="width:100%;padding:8px;" />
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label>Depreciation Method</label>
        <select id="depreciation_method" style="width:100%;padding:8px;">
          <option value="straight_line" selected={asset.depreciation_method === "straight_line"}>Straight Line</option>
          <option value="declining_balance" selected={asset.depreciation_method === "declining_balance"}>Declining Balance</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label>Annual Depreciation</label>
        <input type="number" id="annual_depreciation" value={asset.annual_depreciation} style="width:100%;padding:8px;" />
      </div>
      <div class="form-group" style="margin-bottom:12px;">
        <label>Correction Reason (required)</label>
        <input type="text" id="correction_reason" style="width:100%;padding:8px;" />
      </div>
      <button onclick={`saveAsset(${asset.id})`} style="padding:10px 20px;background:#2c3e50;color:white;border:none;border-radius:4px;">Save</button>
      <script>{`
        async function saveAsset(id) {
          const cost_basis = Number(document.getElementById('cost_basis').value);
          const residual_value = Number(document.getElementById('residual_value').value);
          const useful_life_years = Number(document.getElementById('useful_life_years').value);
          const depreciation_method = document.getElementById('depreciation_method').value;
          const annual_depreciation = Number(document.getElementById('annual_depreciation').value);
          const correction_reason = document.getElementById('correction_reason').value;
          const res = await fetch('/api/assets/' + id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cost_basis, residual_value, useful_life_years, depreciation_method, annual_depreciation, correction_reason }),
            credentials: 'include'
          });
          if (res.ok) location.href = '/assets';
          else alert('Failed to save asset: ' + (await res.json()).error);
        }
      `}</script>
    </Layout>
  );
}
