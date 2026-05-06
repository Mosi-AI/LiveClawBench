/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { formatCents, capitalize } from "./format";

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

interface ClaimsListPageProps {
  user: { first_name: string; last_name: string };
  claims: Claim[];
}

export const ClaimsListPage: FC<ClaimsListPageProps> = ({ user, claims }) => {
  return (
    <Layout title="My Claims" user={user}>
      <h1>My Claims</h1>
      <a href="/claims/new" class="btn">
        + New Claim
      </a>
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Provider</th>
            <th>Date</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id}>
              <td>
                <a href={`/claims/${claim.id}`}>{claim.id}</a>
              </td>
              <td>{claim.claim_type}</td>
              <td>{claim.provider_name}</td>
              <td>{claim.service_date}</td>
              <td>{formatCents(claim.total_amount)}</td>
              <td>
                <span class={`status-badge ${claim.status}`}>
                  {capitalize(claim.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Layout>
  );
};
