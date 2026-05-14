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

interface PlansListPageProps {
  user: { first_name: string; last_name: string };
  plans: Plan[];
}

export const PlansListPage: FC<PlansListPageProps> = ({ user, plans }) => {
  return (
    <Layout title="Insurance Plans" user={user}>
      <h1>Insurance Plans ({plans[0]?.effective_year ?? ""})</h1>
      <div class="plans-grid">
        {plans.map((plan) => (
          <div key={plan.id} class="plan-card">
            <h2>
              {plan.name} ({plan.code})
            </h2>
            <p>{plan.description}</p>
            <p>
              <strong>Premium:</strong> {formatCents(plan.premium_monthly)}/mo
            </p>
            <p>
              <strong>Deductible:</strong> {formatCents(plan.deductible)}
            </p>
            <a href="/plans/select" class="btn">
              View Details
            </a>
          </div>
        ))}
      </div>
    </Layout>
  );
};
