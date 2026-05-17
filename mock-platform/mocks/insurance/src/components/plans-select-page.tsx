/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { formatCents } from "./format";

interface Benefit {
  benefit_category: string;
  coverage_type: string;
  coverage_value: number | null;
  notes: string | null;
}

interface Plan {
  id: number;
  code: string;
  name: string;
  description: string | null;
  effective_year: number;
  premium_monthly: number;
  deductible: number;
}

interface PlanWithBenefits extends Plan {
  benefits: Benefit[];
}

interface PlansSelectPageProps {
  user: { first_name: string; last_name: string };
  plans: PlanWithBenefits[];
}

function formatCoverage(type: string, value: number | null): string {
  if (type === "full_coverage") return "100%";
  if (type === "flat_copay" && value !== null) return formatCents(value);
  if (type === "percentage_after_deductible" && value !== null)
    return `${value}%`;
  return type;
}

export const PlansSelectPage: FC<PlansSelectPageProps> = ({ user, plans }) => {
  return (
    <Layout title="Select a Plan" user={user}>
      <h1>Select a Plan</h1>
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

            <h3>Benefits</h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Coverage</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {plan.benefits.map((b, idx) => (
                  <tr key={idx}>
                    <td>{b.benefit_category}</td>
                    <td>{formatCoverage(b.coverage_type, b.coverage_value)}</td>
                    <td>{b.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <form method="post" action="/plans/select">
              <input type="hidden" name="plan_id" value={String(plan.id)} />
              <button type="submit" class="btn">
                Select {plan.name}
              </button>
            </form>
          </div>
        ))}
      </div>
    </Layout>
  );
};
