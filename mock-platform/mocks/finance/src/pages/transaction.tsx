/** @jsxImportSource hono/jsx */
import { Layout } from "../components/layout";

export function TransactionPage({ transactions }: { transactions: any[] }) {
  const headers = ["Date", "Vendor", "Amount", "Category", "Status", "Approval", ""];

  return (
    <Layout title="Transactions">
      <h2>Transactions</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8f9fa;border-bottom:2px solid #dee2e6;">
            {headers.map((h) => <th style="padding:10px;text-align:left;" key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} style="border-bottom:1px solid #e9ecef;">
              <td style="padding:10px;">{t.trade_date}</td>
              <td style="padding:10px;">{t.vendor_name}</td>
              <td style="padding:10px;">{t.amount}</td>
              <td style="padding:10px;">{t.category}</td>
              <td style="padding:10px;">{t.status}</td>
              <td style="padding:10px;">{t.approval_status}</td>
              <td style="padding:10px;">
                <button onclick={`fetch('/api/transactions/${t.id}/flag',{method:'POST',credentials:'include'}).then(()=>location.reload())`}>
                  Flag
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
