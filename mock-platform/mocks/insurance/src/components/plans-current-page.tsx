/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { formatCents } from "./format";

interface Plan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  effective_year: number;
  premium_monthly: number;
  deductible: number;
}

interface PlansCurrentPageProps {
  user: { first_name: string; last_name: string };
  policy: {
    id: number;
    status: string;
    plan: Plan;
  };
}

export const PlansCurrentPage: FC<PlansCurrentPageProps> = ({ user, policy }) => {
  const plan = policy.plan;
  return (
    <Layout title="Current Plan" user={user}>
      <h1>Current Plan</h1>
      <div class="detail-card">
        <p>
          <strong>Plan:</strong> {plan.name} ({plan.code})
        </p>
        <p>
          <strong>Status:</strong> {policy.status}
        </p>
        <p>
          <strong>Premium:</strong> {formatCents(plan.premium_monthly)}/mo
        </p>
        <p>
          <strong>Deductible:</strong> {formatCents(plan.deductible)}
        </p>
        <p>{plan.description}</p>
      </div>
      <a href="/plans/select" class="btn">
        Change Plan
      </a>
    </Layout>
  );
};
