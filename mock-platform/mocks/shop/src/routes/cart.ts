import { z } from "zod";
import { createRoute, ok, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import {
  AddToCartBodySchema,
  UpdateCartBodySchema,
  CartResponseSchema,
  CartMutationResponseSchema,
  GenericSuccessResponseSchema,
  ErrSchema,
} from "../schemas.js";
import { loadCart, saveCart, clearCart } from "../data/store.js";
import type { Product } from "../types.js";
export function registerCartRoutes(app: OpenAPIApp, getProducts: () => Product[]) {
  // POST /api/cart/add
  const addToCartRoute = createRoute({
    method: "post",
    path: "/api/cart/add",
    summary: "Add item to cart",
    request: {
      body: {
        content: {
          "application/json": {
            schema: AddToCartBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CartMutationResponseSchema,
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
        description: "Product not found",
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

  app.openApiRoute(addToCartRoute, (c) => {
    const { product_id } = c.req.valid("json");

    const product = getProducts().find((p) => p.id === product_id);
    if (!product) return c.json(err("Product not found"), 404);

    const cart = loadCart();
    const existing = cart.find((item) => item.id === product_id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.push({
        id: product.id,
        title: product.title,
        price: product.price,
        rating: product.rating,
        image_url: product.image_url,
        quantity: 1,
      });
    }
    try {
      saveCart(cart);
    } catch (e) {
      console.error("mock-shop: failed to save cart", e);
      return c.json(err("Failed to save cart"), 500);
    }

    return c.json(ok({
      cart_count: cart.reduce((s, i) => s + i.quantity, 0),
    }, `Added ${product.title.slice(0, 50)}... to cart`), 200);
  });

  // GET /api/cart
  const getCartRoute = createRoute({
    method: "get",
    path: "/api/cart",
    summary: "Get cart contents",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CartResponseSchema,
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(getCartRoute, (c) => {
    const cart = loadCart();
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    return c.json(ok({
      items: cart,
      total,
      count: cart.reduce((s, i) => s + i.quantity, 0),
    }));
  });

  // DELETE /api/cart/remove/:product_id
  const removeFromCartRoute = createRoute({
    method: "delete",
    path: "/api/cart/remove/{product_id}",
    summary: "Remove item from cart",
    request: {
      params: z.object({ product_id: z.string() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CartMutationResponseSchema,
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
        description: "Item not found",
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

  app.openApiRoute(removeFromCartRoute, (c) => {
    const { product_id } = c.req.valid("param");
    const cart = loadCart();
    const itemExists = cart.some((item) => item.id === product_id);
    if (!itemExists) return c.json(err("Item not found in cart"), 404);
    const updatedCart = cart.filter((item) => item.id !== product_id);
    try {
      saveCart(updatedCart);
    } catch (e) {
      console.error("mock-shop: failed to save cart", e);
      return c.json(err("Failed to save cart"), 500);
    }
    return c.json(ok({
      cart_count: updatedCart.reduce((s, i) => s + i.quantity, 0),
    }, "Item removed from cart"), 200);
  });

  // PUT /api/cart/update
  const updateCartRoute = createRoute({
    method: "put",
    path: "/api/cart/update",
    summary: "Update cart item quantity",
    request: {
      body: {
        content: {
          "application/json": {
            schema: UpdateCartBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: CartMutationResponseSchema,
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
        description: "Item not found",
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

  app.openApiRoute(updateCartRoute, (c) => {
    const { product_id, quantity } = c.req.valid("json");

    const cart = loadCart();
    const item = cart.find((i) => i.id === product_id);
    if (!item) return c.json(err("Item not found in cart"), 404);
    if (quantity <= 0) {
      const idx = cart.indexOf(item);
      if (idx >= 0) cart.splice(idx, 1);
    } else {
      item.quantity = quantity;
    }
    try {
      saveCart(cart);
    } catch (e) {
      console.error("mock-shop: failed to save cart", e);
      return c.json(err("Failed to save cart"), 500);
    }

    return c.json(ok({
      cart_count: cart.reduce((s, i) => s + i.quantity, 0),
    }, "Cart updated"), 200);
  });

  // POST /api/cart/clear
  const clearCartRoute = createRoute({
    method: "post",
    path: "/api/cart/clear",
    summary: "Clear cart",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: GenericSuccessResponseSchema,
          },
        },
        description: "OK",
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

  app.openApiRoute(clearCartRoute, (c) => {
    try {
      clearCart();
    } catch (e) {
      console.error("mock-shop: failed to clear cart", e);
      return c.json(err("Failed to clear cart"), 500);
    }
    return c.json(ok(null, "Cart cleared"), 200);
  });
}
