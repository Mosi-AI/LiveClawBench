/** @jsxImportSource hono/jsx */
import { Layout } from "../components/layout";

export function DepartmentPage({ departments }: { departments: any[] }) {
  const headers = ["Month", "Department", "Manager", "Budget", "Actual", "Revenue"];
  const rows = departments.map((d) => [
    d.month,
    d.department_name,
    d.manager_email,
    String(d.budget_amount),
    String(d.actual_expense_amount),
    String(d.revenue_amount),
  ]);

  return (
    <Layout title="Departments">
      <h2>Department Financial Records</h2>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="background:#f8f9fa;border-bottom:2px solid #dee2e6;">
            {headers.map((h) => <th style="padding:10px;text-align:left;" key={h}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style="border-bottom:1px solid #e9ecef;">
              {row.map((cell, j) => <td style="padding:10px;" key={j}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
