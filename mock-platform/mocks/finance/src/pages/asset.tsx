/** @jsxImportSource hono/jsx */
import { Layout } from "../components/layout";

export function AssetPage({ assets }: { assets: any[] }) {
  const headers = ["Asset Name", "Cost Basis", "Depreciation Method", ""];

  return (
    <Layout title="Assets">
      <h2>Asset Records</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8f9fa;border-bottom:2px solid #dee2e6;">
            {headers.map((h) => <th style="padding:10px;text-align:left;" key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} style="border-bottom:1px solid #e9ecef;">
              <td style="padding:10px;">{a.asset_name}</td>
              <td style="padding:10px;">{a.cost_basis}</td>
              <td style="padding:10px;">{a.depreciation_method}</td>
              <td style="padding:10px;">
                <a href={`/assets/${a.id}/edit`}>Edit</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
