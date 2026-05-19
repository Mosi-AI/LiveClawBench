/** @jsxImportSource hono/jsx */

export function Table({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  return (
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead>
        <tr style="background:#f8f9fa;border-bottom:2px solid #dee2e6;">
          {headers.map((h) => (
            <th style="padding:10px;text-align:left;font-weight:600;" key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style="border-bottom:1px solid #e9ecef;">
            {row.map((cell, j) => (
              <td style="padding:10px;" key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
