/** @jsxImportSource hono/jsx */
import { Layout } from "../components/layout";

export function AccountDetailPage({ account, transactions }: { account: any; transactions: any[] }) {
  return (
    <Layout title={`Account ${account.account_id}`}>
      <h2>Account {account.account_id}</h2>
      <p>System Balance: {account.system_balance} | Statement Balance: {account.statement_balance} | Diff: {account.diff_amount}</p>
      <h3>Transactions</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8f9fa;border-bottom:2px solid #dee2e6;">
            <th style="padding:10px;text-align:left;">Amount</th>
            <th style="padding:10px;text-align:left;">Status</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} style="border-bottom:1px solid #e9ecef;">
              <td style="padding:10px;">{t.amount}</td>
              <td style="padding:10px;">{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onclick={`fetch('/api/accounts/${account.id}/flag',{method:'POST',credentials:'include'}).then(()=>location.reload())`}>
        Flag Account
      </button>
    </Layout>
  );
}
