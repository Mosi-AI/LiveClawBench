/** @jsxImportSource hono/jsx */
import { Layout } from "../components/layout";
import { INVOICE_CATEGORY_CODES } from "../constants";

export function InvoiceCreatePage({ vendors }: { vendors: any[] }) {
  return (
    <Layout title="New Invoice">
      <h2>Create Invoice</h2>
      <div class="form-group">
        <label>Vendor</label>
        <select id="vendor-id" style="width:100%;padding:8px;">
          {vendors.map((v) => <option value={String(v.id)} key={v.id}>{v.vendor_name}</option>)}
        </select>
      </div>
      <div class="form-group">
        <label>Invoice Number</label>
        <input type="text" id="invoice-number" style="width:100%;padding:8px;" />
      </div>
      <div class="form-group">
        <label>Invoice Date</label>
        <input type="date" id="invoice-date" style="width:100%;padding:8px;" />
      </div>
      <h3>Line Items</h3>
      <div id="items">
        <div class="item-row" style="display:flex;gap:8px;margin-bottom:8px;">
          <input type="text" class="desc" placeholder="Description" style="padding:8px;flex:1;" />
          <select class="category" style="padding:8px;">
            {INVOICE_CATEGORY_CODES.map((c) => <option value={c.code} key={c.code}>{c.code} - {c.name}</option>)}
          </select>
          <input type="number" class="amount" placeholder="Amount" style="padding:8px;width:100px;" />
          <button onclick="this.parentElement.remove();" type="button">Remove</button>
        </div>
      </div>
      <button onclick="addItem()" type="button">Add Item</button>
      <h3>Category Reference</h3>
      <ul style="font-size:12px;color:#666;">
        {INVOICE_CATEGORY_CODES.map((c) => <li key={c.code}>{c.code}: {c.name}</li>)}
      </ul>
      <button onclick="submitInvoice()" style="padding:10px 20px;background:#2c3e50;color:white;border:none;border-radius:4px;">Submit</button>
      <script>{`
        function addItem() {
          const div = document.createElement('div');
          div.className = 'item-row';
          div.style = 'display:flex;gap:8px;margin-bottom:8px;';
          div.innerHTML = '<input type="text" class="desc" placeholder="Description" style="padding:8px;flex:1;" /><select class="category" style="padding:8px;">${INVOICE_CATEGORY_CODES.map(c => '<option value="' + c.code + '">' + c.code + ' - ' + c.name + '</option>').join('')}</select><input type="number" class="amount" placeholder="Amount" style="padding:8px;width:100px;" /><button onclick="this.parentElement.remove();" type="button">Remove</button>';
          document.getElementById('items').appendChild(div);
        }
        async function submitInvoice() {
          const vendor_id = Number(document.getElementById('vendor-id').value);
          const invoice_number = document.getElementById('invoice-number').value;
          const invoice_date = document.getElementById('invoice-date').value;
          const items = [];
          document.querySelectorAll('.item-row').forEach(row => {
            const desc = row.querySelector('.desc').value;
            const cat = row.querySelector('.category').value;
            const amt = Number(row.querySelector('.amount').value);
            if (desc && amt > 0) items.push({ description: desc, category_code: cat, amount: amt });
          });
          const res = await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vendor_id, invoice_number, invoice_date, items }),
            credentials: 'include'
          });
          if (res.ok) location.href = '/';
          else alert('Failed to create invoice');
        }
      `}</script>
    </Layout>
  );
}
