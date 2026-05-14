/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "./layout";

interface ClaimsNewPageProps {
  user: { first_name: string; last_name: string };
  error?: string;
}

export const ClaimsNewPage: FC<ClaimsNewPageProps> = ({ user, error }) => {
  return (
    <Layout title="New Claim" user={user}>
      <h1>Submit a New Claim</h1>
      {error && <p class="error">{error}</p>}
      <form method="post" action="/claims/new" class="form-card">
        <label>
          Claim Type
          <input type="text" name="claim_type" required />
        </label>
        <label>
          Total Amount ($)
          <input type="number" name="total_amount" step="0.01" required />
        </label>
        <label>
          Service Date
          <input type="date" name="service_date" required />
        </label>
        <label>
          Provider Name
          <input type="text" name="provider_name" required />
        </label>
        <label>
          Check Item
          <select name="check_item" required>
            <option value="general_checkup">General Checkup</option>
            <option value="dental">Dental</option>
            <option value="vision">Vision</option>
            <option value="lab">Lab</option>
            <option value="imaging">Imaging</option>
            <option value="specialist">Specialist</option>
          </select>
        </label>
        <label>
          Notes
          <textarea name="notes" rows={3} />
        </label>
        <button type="submit">Submit Claim</button>
      </form>
    </Layout>
  );
};
