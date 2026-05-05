/** @jsxImportSource hono/jsx */
import { Layout } from "../components/layout";

export function DepartmentPage({ departments }: { departments: any[] }) {
  const headers = ["Month", "Department", "Manager", "Budget", "Actual", "Revenue"];

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
          {departments.map((d) => (
            <tr key={d.id} style="border-bottom:1px solid #e9ecef;">
              <td style="padding:10px;">{d.month}</td>
              <td style="padding:10px;">{d.department_name}</td>
              <td style="padding:10px;">{d.manager_email}</td>
              <td style="padding:10px;">{d.budget_amount}</td>
              <td style="padding:10px;">{d.actual_expense_amount}</td>
              <td style="padding:10px;">{d.revenue_amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
}
