/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";
import type { CartItem } from "../types.js";

function escJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

const CartItemComponent: FC<{ item: CartItem }> = ({ item }) => {
  return <div class="cart-item">
    <span class="cart-item-title">{item.title}</span>
    <span class="cart-item-price">{`$${item.price.toFixed(2)}`}</span>
    <span class="cart-item-quantity">
      <button onclick={`updateCart('${escJs(item.id)}', ${item.quantity - 1})`}>-</button>
      <span>{item.quantity}</span>
      <button onclick={`updateCart('${escJs(item.id)}', ${item.quantity + 1})`}>+</button>
    </span>
    <span class="cart-item-subtotal">{`$${(item.price * item.quantity).toFixed(2)}`}</span>
    <button onclick={`removeFromCart('${escJs(item.id)}')`}>Remove</button>
  </div>;
};

export const CartPage: FC<{ cartItems: CartItem[]; total: number }> = ({ cartItems, total }) => {
  const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);
  return <Layout title="Cart" scripts={`
async function updateCart(productId, newQuantity) {
  if (newQuantity < 0) return;
  try {
    const response = await fetch('/api/cart/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, quantity: newQuantity })
    });
    const data = await response.json();
    if (data.success) location.reload();
  } catch (error) {
    console.error('Error updating quantity:', error);
  }
}

async function removeFromCart(productId) {
  if (!confirm('Remove this item from cart?')) return;
  try {
    const response = await fetch('/api/cart/remove/' + productId, { method: 'DELETE' });
    const data = await response.json();
    if (data.success) location.reload();
  } catch (error) {
    console.error('Error removing item:', error);
  }
}

async function clearCartAction() {
  if (!confirm('Clear all items from cart?')) return;
  try {
    const response = await fetch('/api/cart/clear', { method: 'POST' });
    const data = await response.json();
    if (data.success) location.reload();
  } catch (error) {
    console.error('Error clearing cart:', error);
  }
}

async function checkout() {
  try {
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) {
      const el = document.getElementById('cart-count');
      if (el) el.textContent = '0';
      window.location.href = '/orders';
    } else {
      alert('Checkout failed: ' + data.message);
    }
  } catch (error) {
    console.error('Error during checkout:', error);
  }
}`}>
    <div class="container">
      <h1>Shopping Cart</h1>
      {cartItems.length > 0
        ? <>
            {cartItems.map((item) => <CartItemComponent item={item} />)}
            <div class="cart-total">
              <p>{`Items: ${totalItems}`}</p>
              <p>{`Total: $${total.toFixed(2)}`}</p>
              <button class="checkout-btn" onclick="checkout()">Checkout</button>
              <button class="clear-btn" onclick="clearCartAction()">Clear Cart</button>
            </div>
          </>
        : <p>Your cart is empty.</p>
      }
    </div>
  </Layout>;
};
