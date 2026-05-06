/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { formatCents, capitalize } from "./format";

interface LineItem {
  id: number;
  description: string;
  amount_cents: number;
}

interface Attachment {
  id: number;
  filename: string;
  file_path: string;
}

interface Claim {
  id: number;
  claim_type: string;
  total_amount: number;
  service_date: string;
  provider_name: string;
  check_item: string;
  status: string;
  notes: string | null;
}

interface ClaimDetailPageProps {
  user: { first_name: string; last_name: string };
  claim: Claim;
  line_items: LineItem[];
  attachments: Attachment[];
}

export const ClaimDetailPage: FC<ClaimDetailPageProps> = ({
  user,
  claim,
  line_items,
  attachments,
}) => {
  return (
    <Layout title={`Claim #${claim.id}`} user={user}>
      <h1>Claim #{claim.id}</h1>
      <a href="/claims">← Back to Claims</a>
      <div class="detail-card">
        <p>
          <strong>Type:</strong> {claim.claim_type}
        </p>
        <p>
          <strong>Provider:</strong> {claim.provider_name}
        </p>
        <p>
          <strong>Date:</strong> {claim.service_date}
        </p>
        <p>
          <strong>Amount:</strong> {formatCents(claim.total_amount)}
        </p>
        <p>
          <strong>Status:</strong>{" "}
          <span class={`status-badge ${claim.status}`}>
            {capitalize(claim.status)}
          </span>
        </p>
        <p>
          <strong>Check Item:</strong> {claim.check_item}
        </p>
        {claim.notes ? (
          <p>
            <strong>Notes:</strong> {claim.notes}
          </p>
        ) : null}
      </div>

      <h2>Line Items</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {line_items.map((item) => (
            <tr key={item.id}>
              <td>{item.description}</td>
              <td>{formatCents(item.amount_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Attachments</h2>
      {attachments.length === 0 ? (
        <p>No attachments.</p>
      ) : (
        <ul>
          {attachments.map((att) => (
            <li key={att.id}>
              <a href={att.file_path}>{att.filename}</a>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
};
