/** @jsxImportSource hono/jsx */
import { Layout } from "../components/layout";

export function AccountPage({ accounts }: { accounts: any[] }) {
  const headers = ["Account ID", "System Balance", "Statement Balance", "Diff"];

  return (
    <Layout title="Accounts">
      <h2>Account Balances</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8f9fa;border-bottom:2px solid #dee2e6;">
            {headers.map((h) => <th style="padding:10px;text-align:left;" key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} style="border-bottom:1px solid #e9ecef;">
              <td style="padding:10px;">
                <a href={`/accounts/${a.id}`}>{a.account_id}</a>
              </td>
              <td style="padding:10px;">{a.system_balance}</td>
              <td style="padding:10px;">{a.statement_balance}</td>
              <td style="padding:10px;">{a.diff_amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
