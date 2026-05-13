/** @jsxImportSource hono/jsx */
import type { FC, Child } from "hono/jsx";
import { Layout } from "./layout.js";
import type { UserData, Order } from "../types.js";

function escJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

const ORDERS_JS = `async function returnOrder(orderId) {
  try {
    const response = await fetch('/api/orders/' + orderId + '/return', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) {
      location.reload();
    } else {
      alert('Failed to request return: ' + data.message);
    }
  } catch (error) {
    console.error('Error requesting return:', error);
  }
}

async function confirmOrder(orderId) {
  try {
    const response = await fetch('/api/orders/' + orderId + '/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (data.success) {
      location.reload();
    } else {
      alert('Failed to confirm: ' + data.message);
    }
  } catch (error) {
    console.error('Error confirming delivery:', error);
  }
}`;

export const OrdersPage: FC<{ user: UserData; orders: Order[] }> = ({ user, orders }) => {
  const orderElements: Child[] = orders.map((order) => {
    const itemElements: Child[] = order.items.map((item) =>
      <div class="order-item">
        <span>{item.title}</span>
        <span>{`Qty: ${item.quantity}`}</span>
        <span>{`$${item.price.toFixed(2)}`}</span>
      </div>
    );

    let actionButtons: Child = null;
    if (order.status === "Delivered") {
      actionButtons = <>
        <button onclick={`confirmOrder('${escJs(order.order_id)}')`}>Confirm Receipt</button>
        <button onclick={`returnOrder('${escJs(order.order_id)}')`}>Return</button>
      </>;
    } else if (["Pending Shipment", "Shipped", "Completed"].includes(order.status)) {
      actionButtons = <button onclick={`returnOrder('${escJs(order.order_id)}')`}>Return</button>;
    }

    return <div class="order">
      <div class="order-header">
        <span class="order-id">{`Order: ${order.order_id}`}</span>
        <span class={`order-status ${order.status.toLowerCase().replace(/\s/g, "-")}`}>{order.status}</span>
        <span class="order-date">{order.create_time}</span>
        <span class="order-total">{`$${order.total_amount.toFixed(2)}`}</span>
      </div>
      <div class="order-items">{itemElements}</div>
      <div class="order-actions">{actionButtons}</div>
    </div>;
  });

  return <Layout title="Orders" scripts={ORDERS_JS}>
    <div class="container">
      <h1>Order History</h1>
      <p class="meta">{`${user.username} — ${orders.length} orders`}</p>
      {orders.length > 0 ? orderElements : <p>No orders found.</p>}
    </div>
  </Layout>;
};
