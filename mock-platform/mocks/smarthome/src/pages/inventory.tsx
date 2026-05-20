/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "../components/layout";
import type { GroceryProduct, InventoryItem } from "../types";
import { escJs } from "./utils";

export const InventoryPage: FC<{ items: InventoryItem[] }> = ({ items }) => {
  const fridgeItems = items.filter((item) => item.location === "fridge");
  const pantryItems = items.filter((item) => item.location === "pantry");

  return <Layout title="Inventory" scripts={`
let editingId = null;

function openAddModal(location) {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Item';
  document.getElementById('item-id').value = '';
  document.getElementById('item-name').value = '';
  document.getElementById('item-quantity').value = '';
  document.getElementById('item-unit').value = '';
  document.getElementById('item-location').value = location;
  document.getElementById('item-expiry').value = '';
  document.getElementById('item-category').value = '';
  document.getElementById('item-modal').style.display = 'block';
}

function openEditModal(id, name, quantity, unit, location, expiry, category) {
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Item';
  document.getElementById('item-id').value = id;
  document.getElementById('item-name').value = name;
  document.getElementById('item-quantity').value = quantity;
  document.getElementById('item-unit').value = unit;
  document.getElementById('item-location').value = location;
  document.getElementById('item-expiry').value = expiry || '';
  document.getElementById('item-category').value = category || '';
  document.getElementById('item-modal').style.display = 'block';
}

function closeModal() {
  document.getElementById('item-modal').style.display = 'none';
  editingId = null;
}

async function saveItem() {
  const name = document.getElementById('item-name').value.trim();
  const quantity = parseFloat(document.getElementById('item-quantity').value);
  const unit = document.getElementById('item-unit').value.trim();
  const storageLocation = document.getElementById('item-location').value;
  const expiry = document.getElementById('item-expiry').value.trim() || null;
  const category = document.getElementById('item-category').value.trim() || null;

  if (!name || isNaN(quantity) || !unit || !storageLocation) {
    alert('Please fill in all required fields');
    return;
  }

  const body = { item_name: name, quantity, unit, location: storageLocation, expiry_date: expiry, category };

  try {
    const url = editingId ? '/api/inventory/' + editingId : '/api/inventory';
    const method = editingId ? 'PUT' : 'POST';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    const errorMessage = data.error || data.message;
    if (errorMessage) alert('Error: ' + errorMessage);
    else { closeModal(); window.location.reload(); }
  } catch (err) { alert('Failed to save item'); }
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  try {
    const response = await fetch('/api/inventory/' + id, { method: 'DELETE' });
    const data = await response.json();
    const errorMessage = data.error || data.message;
    if (errorMessage) alert('Error: ' + errorMessage);
    else location.reload();
  } catch (err) { alert('Failed to delete item'); }
}

window.onclick = function(event) {
  const modal = document.getElementById('item-modal');
  if (event.target === modal) closeModal();
}
`}>
    <h1>Inventory</h1>

    <div id="item-modal" style="display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.4);">
      <div style="background:white; margin:80px auto; padding:20px; border-radius:8px; width:400px; max-width:90%;">
        <h2 id="modal-title" style="margin-top:0;">Add Item</h2>
        <input type="hidden" id="item-id" />
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Name *</label>
          <input type="text" id="item-name" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Quantity *</label>
          <input type="number" id="item-quantity" step="any" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Unit *</label>
          <input type="text" id="item-unit" placeholder="e.g. kg, lbs, pieces" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Location *</label>
          <select id="item-location" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            <option value="fridge">Fridge</option>
            <option value="pantry">Pantry</option>
          </select>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Expiry Date</label>
          <input type="date" id="item-expiry" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Category</label>
          <input type="text" id="item-category" placeholder="e.g. dairy, vegetables" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn" onclick="saveItem()">Save</button>
        </div>
      </div>
    </div>

    <h2>Fridge</h2>
    <button class="btn" onclick="openAddModal('fridge')" style="margin-bottom:15px;">Add Item</button>
    {fridgeItems.length > 0 ? (
      <table>
        <thead><tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Expiry</th><th>Actions</th></tr></thead>
        <tbody>
          {fridgeItems.map((item) => (
            <tr>
              <td>{item.item_name}</td>
              <td>{item.quantity}</td>
              <td>{item.unit}</td>
              <td>{item.expiry_date || "-"}</td>
              <td>
                <button class="btn btn-secondary" onclick={`openEditModal(${item.id}, '${escJs(item.item_name)}', ${item.quantity}, '${escJs(item.unit)}', 'fridge', '${item.expiry_date || ""}', '${escJs(item.category || "")}')`}>Edit</button>
                <button class="btn btn-danger" onclick={`deleteItem(${item.id})`}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : <p>No items in fridge.</p>}

    <h2>Pantry</h2>
    <button class="btn" onclick="openAddModal('pantry')" style="margin-bottom:15px;">Add Item</button>
    {pantryItems.length > 0 ? (
      <table>
        <thead><tr><th>Item</th><th>Quantity</th><th>Unit</th><th>Expiry</th><th>Category</th><th>Actions</th></tr></thead>
        <tbody>
          {pantryItems.map((item) => (
            <tr>
              <td>{item.item_name}</td>
              <td>{item.quantity}</td>
              <td>{item.unit}</td>
              <td>{item.expiry_date || "-"}</td>
              <td>{item.category || "-"}</td>
              <td>
                <button class="btn btn-secondary" onclick={`openEditModal(${item.id}, '${escJs(item.item_name)}', ${item.quantity}, '${escJs(item.unit)}', 'pantry', '${item.expiry_date || ""}', '${escJs(item.category || "")}')`}>Edit</button>
                <button class="btn btn-danger" onclick={`deleteItem(${item.id})`}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : <p>No items in pantry.</p>}
  </Layout>;
};

export const GroceryPage: FC<{ products: GroceryProduct[] }> = ({ products }) => {
  return <Layout title="Shopping List" scripts={`
let editingId = null;

function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = 'Add Item';
  document.getElementById('item-id').value = '';
  document.getElementById('item-name').value = '';
  document.getElementById('item-quantity').value = '';
  document.getElementById('item-unit').value = '';
  document.getElementById('item-stock').value = 'sufficient';
  document.getElementById('item-reference').value = '';
  document.getElementById('item-modal').style.display = 'block';
}

function openEditModal(id, name, quantity, unit, stockStatus, reference) {
  editingId = id;
  document.getElementById('modal-title').textContent = 'Edit Item';
  document.getElementById('item-id').value = id;
  document.getElementById('item-name').value = name;
  document.getElementById('item-quantity').value = quantity;
  document.getElementById('item-unit').value = unit;
  document.getElementById('item-stock').value = stockStatus;
  document.getElementById('item-reference').value = reference || '';
  document.getElementById('item-modal').style.display = 'block';
}

function closeModal() {
  document.getElementById('item-modal').style.display = 'none';
  editingId = null;
}

async function saveItem() {
  const name = document.getElementById('item-name').value.trim();
  const quantity = parseFloat(document.getElementById('item-quantity').value);
  const unit = document.getElementById('item-unit').value.trim();
  const stockStatus = document.getElementById('item-stock').value;
  const reference = document.getElementById('item-reference').value.trim() || null;

  if (!name || isNaN(quantity) || !unit || !stockStatus) {
    alert('Please fill in all required fields');
    return;
  }

  const body = { name, quantity, unit, stock_status: stockStatus, reference };

  try {
    const url = editingId ? '/api/grocery/products/' + editingId : '/api/grocery/products';
    const method = editingId ? 'PUT' : 'POST';
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    const errorMessage = data.error || data.message;
    if (errorMessage) alert('Error: ' + errorMessage);
    else { closeModal(); location.reload(); }
  } catch (err) { alert('Failed to save item'); }
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  try {
    const response = await fetch('/api/grocery/products/' + id, { method: 'DELETE' });
    const data = await response.json();
    const errorMessage = data.error || data.message;
    if (errorMessage) alert('Error: ' + errorMessage);
    else location.reload();
  } catch (err) { alert('Failed to delete item'); }
}

window.onclick = function(event) {
  const modal = document.getElementById('item-modal');
  if (event.target === modal) closeModal();
}
`}>
    <h1>Shopping List</h1>

    <div id="item-modal" style="display:none; position:fixed; z-index:1000; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.4);">
      <div style="background:white; margin:80px auto; padding:20px; border-radius:8px; width:400px; max-width:90%;">
        <h2 id="modal-title" style="margin-top:0;">Add Item</h2>
        <input type="hidden" id="item-id" />
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Name *</label>
          <input type="text" id="item-name" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Quantity *</label>
          <input type="number" id="item-quantity" step="any" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Unit *</label>
          <input type="text" id="item-unit" placeholder="e.g. kg, lbs, pieces" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Stock Status *</label>
          <select id="item-stock" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;">
            <option value="sufficient">Sufficient</option>
            <option value="insufficient">Insufficient</option>
            <option value="unavailable">Unavailable</option>
          </select>
        </div>
        <div style="margin-bottom:16px;">
          <label style="display:block; margin-bottom:4px; font-weight:500;">Order Reference</label>
          <input type="text" id="item-reference" placeholder="e.g. ORD000001" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:4px;" />
        </div>
        <div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
          <button class="btn" onclick="saveItem()">Save</button>
        </div>
      </div>
    </div>

    <button class="btn" onclick="openAddModal()" style="margin-bottom:15px;">Add Item</button>
    {products.length > 0 ? (
      <table>
        <thead><tr><th>Product</th><th>Quantity</th><th>Unit</th><th>Stock</th><th>Order Reference</th><th>Actions</th></tr></thead>
        <tbody>
          {products.map((product) => (
            <tr>
              <td>{product.name}</td>
              <td>{product.quantity}</td>
              <td>{product.unit}</td>
              <td>
                <span class={`status-badge ${product.stock_status === "sufficient" ? "status-ready" : product.stock_status === "insufficient" ? "status-brewing" : "status-scheduled"}`}>
                  {product.stock_status.replace("_", " ").toUpperCase()}
                </span>
              </td>
              <td>{product.reference || "-"}</td>
              <td>
                <button class="btn btn-secondary" onclick={`openEditModal('${escJs(product.product_id)}', '${escJs(product.name)}', ${product.quantity}, '${escJs(product.unit)}', '${escJs(product.stock_status)}', '${escJs(product.reference || "")}')`}>Edit</button>
                <button class="btn btn-danger" onclick={`deleteItem('${escJs(product.product_id)}')`}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : <p>No items in shopping list.</p>}
  </Layout>;
};
