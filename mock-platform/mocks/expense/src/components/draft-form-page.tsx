/** @jsxImportSource hono/jsx */
import { Layout } from "./layout.js";
import type { FC } from "hono/jsx";

export const DraftFormPage: FC = () => {
  return (
    <Layout title="New Expense">
      <div class="draft-form-container">
        <form method="post" action="/drafts/new" class="draft-form" enctype="multipart/form-data">
          <div class="upload-zone">
            <div class="upload-zone-content">
              <span class="upload-icon">&#128196;</span>
              <p>Drop receipt here or click to upload</p>
              <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.html,.csv" class="upload-input" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="vendor_name">Merchant</label>
              <input type="text" id="vendor_name" name="vendor_name" required placeholder="Vendor name" />
            </div>
            <div class="form-group">
              <label for="amount">Amount</label>
              <input type="number" id="amount" name="amount" step="0.01" min="0.01" required placeholder="0.00" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="invoice_date">Date</label>
              <input type="date" id="invoice_date" name="invoice_date" required />
            </div>
            <div class="form-group">
              <label for="category">Category</label>
              <select id="category" name="category">
                <option value="">Select category...</option>
                <option value="travel">Travel</option>
                <option value="meals">Meals</option>
                <option value="office_supplies">Office Supplies</option>
                <option value="software">Software</option>
                <option value="lodging">Lodging</option>
                <option value="transport">Transport</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="notes">Description</label>
            <textarea id="notes" name="notes" rows="3" maxlength="2000" placeholder="Add notes..."></textarea>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">Create expense</button>
            <a href="/dashboard" class="btn btn-outline">Cancel</a>
          </div>
        </form>
      </div>
    </Layout>
  );
};
