/** @jsxImportSource hono/jsx */
import { Layout } from "../components/layout";

export function ExpenseCreatePage() {
  return (
    <Layout title="New Expense Report">
      <h2>Create Expense Report</h2>
      <div class="form-group">
        <label>Trip Name</label>
        <input type="text" id="trip-name" style="width:100%;padding:8px;" />
      </div>
      <div id="items">
        <div class="item-row" style="display:flex;gap:8px;margin-bottom:8px;">
          <select class="category" style="padding:8px;">
            <option value="flight">Flight</option>
            <option value="hotel">Hotel</option>
            <option value="meals">Meals</option>
            <option value="transport">Transport</option>
          </select>
          <input type="number" class="amount" placeholder="Amount" style="padding:8px;flex:1;" />
          <button onclick="this.parentElement.remove();updateTotal();" type="button">Remove</button>
        </div>
      </div>
      <button onclick="addItem()" type="button">Add Item</button>
      <p>Total: <span id="total">0</span></p>
      <button onclick="submitExpense()" style="padding:10px 20px;background:#2c3e50;color:white;border:none;border-radius:4px;">Submit</button>
      <script>{`
        function addItem() {
          const div = document.createElement('div');
          div.className = 'item-row';
          div.style = 'display:flex;gap:8px;margin-bottom:8px;';
          div.innerHTML = '<select class="category" style="padding:8px;"><option value="flight">Flight</option><option value="hotel">Hotel</option><option value="meals">Meals</option><option value="transport">Transport</option></select><input type="number" class="amount" placeholder="Amount" style="padding:8px;flex:1;" /><button onclick="this.parentElement.remove();updateTotal();" type="button">Remove</button>';
          document.getElementById('items').appendChild(div);
        }
        function updateTotal() {
          let total = 0;
          document.querySelectorAll('.amount').forEach(i => total += Number(i.value || 0));
          document.getElementById('total').textContent = total.toFixed(2);
        }
        document.getElementById('items').addEventListener('input', updateTotal);
        async function submitExpense() {
          const trip_name = document.getElementById('trip-name').value;
          const items = [];
          document.querySelectorAll('.item-row').forEach(row => {
            const cat = row.querySelector('.category').value;
            const amt = Number(row.querySelector('.amount').value);
            if (amt > 0) items.push({ expense_category: cat, amount: amt });
          });
          const res = await fetch('/api/expense-reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trip_name, items }),
            credentials: 'include'
          });
          if (res.ok) location.href = '/';
          else alert('Failed to create expense report');
        }
      `}</script>
    </Layout>
  );
}
