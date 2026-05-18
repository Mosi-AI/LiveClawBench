import { z } from "zod";
import { createRoute, ok, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import {
  ListOrdersResponseSchema,
  GenericSuccessResponseSchema,
  ErrSchema,
} from "../schemas.js";
import { loadOrders, saveOrders } from "../data/store.js";

export function registerOrderRoutes(app: OpenAPIApp) {
  // GET /api/orders
  const listOrdersRoute = createRoute({
    method: "get",
    path: "/api/orders",
    summary: "List orders",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ListOrdersResponseSchema,
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listOrdersRoute, (c) => {
    const orders = loadOrders();
    return c.json(ok({ orders, total: orders.length }));
  });

  // POST /api/orders/:order_id/return
  const returnOrderRoute = createRoute({
    method: "post",
    path: "/api/orders/{order_id}/return",
    summary: "Request order return",
    request: {
      params: z.object({ order_id: z.string() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: GenericSuccessResponseSchema,
          },
        },
        description: "OK",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Order not found",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Cannot return this order",
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

  app.openApiRoute(returnOrderRoute, (c) => {
    const { order_id } = c.req.valid("param");
    const orders = loadOrders();
    const order = orders.find((o) => o.order_id === order_id);
    if (!order) return c.json(err("Order not found"), 404);

    const allowedStatuses = ["Pending Shipment", "Delivered", "Shipped", "Completed"];
    if (!allowedStatuses.includes(order.status)) {
      return c.json(err("This order cannot be returned"), 400);
    }

    order.status = "Returning";
    try {
      saveOrders(orders);
    } catch (e) {
      console.error("mock-shop: failed to save orders", e);
      return c.json(err("Failed to update order"), 500);
    }
    return c.json(ok(null, "Return request received. Customer service will contact you regarding the return."), 200);
  });

  // POST /api/orders/:order_id/confirm
  const confirmOrderRoute = createRoute({
    method: "post",
    path: "/api/orders/{order_id}/confirm",
    summary: "Confirm order delivery",
    request: {
      params: z.object({ order_id: z.string() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: GenericSuccessResponseSchema,
          },
        },
        description: "OK",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Order not found",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Only delivered orders can be confirmed",
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

  app.openApiRoute(confirmOrderRoute, (c) => {
    const { order_id } = c.req.valid("param");
    const orders = loadOrders();
    const order = orders.find((o) => o.order_id === order_id);
    if (!order) return c.json(err("Order not found"), 404);
    if (order.status !== "Delivered") {
      return c.json(err("Only delivered orders can be confirmed"), 400);
    }

    order.status = "Completed";
    try {
      saveOrders(orders);
    } catch (e) {
      console.error("mock-shop: failed to save orders", e);
      return c.json(err("Failed to update order"), 500);
    }
    return c.json(ok(null, "Order confirmed as completed."), 200);
  });
}
