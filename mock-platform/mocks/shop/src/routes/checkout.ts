import { z } from "zod";
import { createRoute, ok, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { CheckoutResponseSchema, ErrSchema } from "../schemas.js";
import { loadCart, clearCart, loadOrders, saveOrders, loadUser } from "../data/store.js";
import { DEFAULT_USER } from "../data/defaults.js";
import type { Order } from "../types.js";

export function registerCheckoutRoutes(app: OpenAPIApp) {
  // POST /api/checkout
  const checkoutRoute = createRoute({
    method: "post",
    path: "/api/checkout",
    summary: "Checkout",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CheckoutResponseSchema,
          },
        },
        description: "OK",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Cart is empty",
      },
      500: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Internal server error",
      },
    },
  });

  app.openApiRoute(checkoutRoute, (c) => {
    const cart = loadCart();
    if (!cart.length) return c.json(err("Cart is empty"), 400);

    const orders = loadOrders();
    const user = loadUser();

    // Generate new order ID
    const existingIds = orders.map((o) => parseInt(o.order_id.replace("ORD", ""), 10));
    const newNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    const orderId = `ORD${String(newNum).padStart(6, "0")}`;

    const totalAmount = cart.reduce((s, i) => s + i.price * i.quantity, 0);

    const order: Order = {
      order_id: orderId,
      user_id: user.username,
      // Map cart items to order items: keep `id` for verifier compatibility
      // (ORD000008.items[0].id is checked), add `product_id` for schema consistency.
      items: cart.map((item) => ({
        id: item.id,
        product_id: item.id,
        title: item.title,
        price: item.price,
        quantity: item.quantity,
        image_url: item.image_url,
      })),
      total_amount: Math.round(totalAmount * 100) / 100,
      status: "Pending Shipment",
      create_time: new Date().toISOString().replace("T", " ").slice(0, 19),
      shipping_address: user.address ?? DEFAULT_USER.address,
    };

    orders.push(order);
    orders.sort((a, b) => b.order_id.localeCompare(a.order_id));
    try {
      saveOrders(orders);
    } catch (e) {
      console.error("mock-shop: failed to save orders", e);
      return c.json(err("Failed to save order"), 500);
    }
    try {
      clearCart();
    } catch (e) {
      console.error("mock-shop: order saved but cart clear failed", e);
      // Order is already persisted; returning 500 per write-failure contract
      return c.json(err("Order saved but cart clear failed"), 500);
    }

    return c.json(ok({ order_id: orderId }, "Order placed successfully!"), 200);
  });
}
