import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createShopApp } from "./index";
import type { OpenAPIApp } from "mock-lib";

// Path to the checked-in product fixture used by watch-shop task
const PRODUCTS_PATH = join(
  import.meta.dir,
  "../../../static/shop/sample_products.json",
);

describe("createShopApp — Layer 1 route tests", () => {
  let dataDir: string;
  let shop: ReturnType<typeof createShopApp>;
  let app: OpenAPIApp;

  beforeEach(async () => {
    // Create a fresh temp directory for each test to avoid state leakage
    dataDir = mkdtempSync(join(tmpdir(), "shop-test-"));

    // Set env vars BEFORE importing / creating the app
    process.env.MOCK_DATA_DIR = dataDir;
    process.env.MOCK_PRODUCTS_PATH = PRODUCTS_PATH;

    shop = createShopApp();
    app = shop.app;
    await shop.seed!();
  });

  afterEach(() => {
    // Clean up temp directory
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
    delete process.env.MOCK_DATA_DIR;
    delete process.env.MOCK_PRODUCTS_PATH;
  });

  // ---------------------------------------------------------------------------
  // Sentinel
  // ---------------------------------------------------------------------------

  test("GET /__mock_sentinel__/shop returns { ok: true }", async () => {
    const res = await app.request("/__mock_sentinel__/shop");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // HTML pages (smoke tests)
  // ---------------------------------------------------------------------------

  test("GET / returns HTML home page", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).not.toContain("[object Object]");
    expect(text).toContain("Welcome to Mosi Shop");
  });

  test("GET /search?q=watch returns HTML search results", async () => {
    const res = await app.request("/search?q=watch");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).not.toContain("[object Object]");
    expect(text).toContain("Search Results");
  });

  test("GET /cart returns HTML cart page", async () => {
    const res = await app.request("/cart");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).not.toContain("[object Object]");
    expect(text).toContain("Shopping Cart");
  });

  test("GET /profile returns HTML profile page", async () => {
    const res = await app.request("/profile");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).not.toContain("[object Object]");
    expect(text).toContain("Peter Griffin");
  });

  test("GET /orders returns HTML orders page", async () => {
    const res = await app.request("/orders");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const text = await res.text();
    expect(text).not.toContain("[object Object]");
    expect(text).toContain("Order History");
  });

  // ---------------------------------------------------------------------------
  // GET /api/products
  // ---------------------------------------------------------------------------

  test("GET /api/products returns products list with pagination fields", async () => {
    const res = await app.request("/api/products");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("products");
    expect(body).toHaveProperty("total_products");
    expect(body).toHaveProperty("total_pages");
    expect(body).toHaveProperty("current_page");
    expect(body).toHaveProperty("products_per_page");
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products.length).toBeGreaterThan(0);
    expect(body.current_page).toBe(1);
    expect(body.products_per_page).toBe(30);
  });

  test("GET /api/products?q=watch&sort=price_asc&page=1 — search + filters", async () => {
    const res = await app.request("/api/products?q=watch&sort=price_asc&page=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products.length).toBeGreaterThan(0);
    // Verify price_asc sorting
    for (let i = 1; i < body.products.length; i++) {
      expect(body.products[i].price).toBeGreaterThanOrEqual(body.products[i - 1].price);
    }
  });

  test("GET /api/products?page=abc — silent fallback to page 1 (coercion)", async () => {
    const res = await app.request("/api/products?page=abc");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.current_page).toBe(1);
  });

  test("GET /api/products?min_price=abc — 400 for invalid numeric filter", async () => {
    const res = await app.request("/api/products?min_price=abc");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  // ---------------------------------------------------------------------------
  // GET /api/product/:product_id
  // ---------------------------------------------------------------------------

  test("GET /api/product/:product_id returns product", async () => {
    const res = await app.request("/api/product/prod_0001");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("id", "prod_0001");
    expect(body).toHaveProperty("title");
    expect(body).toHaveProperty("price");
    expect(body).toHaveProperty("rating");
  });

  test("GET /api/product/unknown-id returns 404", async () => {
    const res = await app.request("/api/product/unknown-id");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Product not found");
  });

  // ---------------------------------------------------------------------------
  // POST /api/cart/add
  // ---------------------------------------------------------------------------

  test("POST /api/cart/add adds item and returns success + cart_count", async () => {
    const res = await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("message");
    expect(body.cart_count).toBe(1);
  });

  test("POST /api/cart/add with missing body returns 400", async () => {
    const res = await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("POST /api/cart/add with unknown product_id returns 404", async () => {
    const res = await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "nonexistent" }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Product not found");
  });

  // ---------------------------------------------------------------------------
  // GET /api/cart
  // ---------------------------------------------------------------------------

  test("GET /api/cart returns items, total, count", async () => {
    // First add an item
    await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001" }),
    });

    const res = await app.request("/api/cart");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("items");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("count");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBe(1);
    expect(body.count).toBe(1);
    expect(body.total).toBeGreaterThan(0);
  });

  test("GET /api/cart returns empty cart initially", async () => {
    const res = await app.request("/api/cart");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.count).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // DELETE /api/cart/remove/:product_id
  // ---------------------------------------------------------------------------

  test("DELETE /api/cart/remove/:product_id removes item", async () => {
    // Add item first
    await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001" }),
    });

    const res = await app.request("/api/cart/remove/prod_0001", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.cart_count).toBe(0);
  });

  test("DELETE /api/cart/remove/:product_id returns 404 if not in cart", async () => {
    const res = await app.request("/api/cart/remove/prod_9999", {
      method: "DELETE",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Item not found in cart");
  });

  // ---------------------------------------------------------------------------
  // PUT /api/cart/update
  // ---------------------------------------------------------------------------

  test("PUT /api/cart/update updates quantity", async () => {
    // Add item first
    await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001" }),
    });

    const res = await app.request("/api/cart/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001", quantity: 3 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.cart_count).toBe(3);
  });

  test("PUT /api/cart/update with quantity 0 removes item", async () => {
    // Add item first
    await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001" }),
    });

    const res = await app.request("/api/cart/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001", quantity: 0 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.cart_count).toBe(0);
  });

  test("PUT /api/cart/update returns 404 for item not in cart", async () => {
    const res = await app.request("/api/cart/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_9999", quantity: 2 }),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Item not found in cart");
  });

  test("PUT /api/cart/update returns 400 for invalid input", async () => {
    const res = await app.request("/api/cart/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001", quantity: -1 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // ---------------------------------------------------------------------------
  // POST /api/cart/clear
  // ---------------------------------------------------------------------------

  test("POST /api/cart/clear clears cart", async () => {
    // Add items first
    await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001" }),
    });

    const res = await app.request("/api/cart/clear", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify cart is empty
    const cartRes = await app.request("/api/cart");
    const cartBody = await cartRes.json();
    expect(cartBody.count).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // POST /api/checkout
  // ---------------------------------------------------------------------------

  test("POST /api/checkout places order from cart", async () => {
    // Add item first
    await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001" }),
    });

    const res = await app.request("/api/checkout", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("order_id");
    expect(body.message).toContain("Order placed");

    // Verify cart is cleared after checkout
    const cartRes = await app.request("/api/cart");
    const cartBody = await cartRes.json();
    expect(cartBody.count).toBe(0);
  });

  test("POST /api/checkout returns 400 if cart is empty", async () => {
    const res = await app.request("/api/checkout", {
      method: "POST",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Cart is empty");
  });

  // ---------------------------------------------------------------------------
  // GET /api/user
  // ---------------------------------------------------------------------------

  test("GET /api/user returns user profile", async () => {
    const res = await app.request("/api/user");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("username", "Peter Griffin");
    expect(body).toHaveProperty("email");
    expect(body).toHaveProperty("address");
    expect(body).toHaveProperty("payment_methods");
    expect(Array.isArray(body.payment_methods)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // POST /api/user/update
  // ---------------------------------------------------------------------------

  test("POST /api/user/update updates field", async () => {
    const res = await app.request("/api/user/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "username", value: "New Name" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify update persisted
    const userRes = await app.request("/api/user");
    const userBody = await userRes.json();
    expect(userBody.username).toBe("New Name");
  });

  test("POST /api/user/update returns 400 for invalid field", async () => {
    const res = await app.request("/api/user/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "invalid_field", value: "test" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  // ---------------------------------------------------------------------------
  // GET /api/orders
  // ---------------------------------------------------------------------------

  test("GET /api/orders returns orders list", async () => {
    const res = await app.request("/api/orders");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("orders");
    expect(body).toHaveProperty("total");
    expect(Array.isArray(body.orders)).toBe(true);
    expect(body.orders.length).toBeGreaterThan(0);
    expect(body.total).toBe(body.orders.length);
  });

  // ---------------------------------------------------------------------------
  // POST /api/orders/:order_id/return
  // ---------------------------------------------------------------------------

  test("POST /api/orders/:order_id/return — return request for valid order", async () => {
    // Get existing orders
    const ordersRes = await app.request("/api/orders");
    const ordersBody = await ordersRes.json();
    const order = ordersBody.orders[0];

    const res = await app.request(`/api/orders/${order.order_id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("POST /api/orders/:order_id/return returns 404 for unknown order", async () => {
    const res = await app.request("/api/orders/UNKNOWN/return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Order not found");
  });

  test("POST /api/orders/:order_id/return returns 400 for invalid status", async () => {
    // Get existing orders
    const ordersRes = await app.request("/api/orders");
    const ordersBody = await ordersRes.json();
    const order = ordersBody.orders[0];

    // First return it
    await app.request(`/api/orders/${order.order_id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    // Try returning again (now status is "Returning")
    const res = await app.request(`/api/orders/${order.order_id}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error", "This order cannot be returned");
  });

  // ---------------------------------------------------------------------------
  // POST /api/orders/:order_id/confirm
  // ---------------------------------------------------------------------------

  test("POST /api/orders/:order_id/confirm — confirm receipt for delivered order", async () => {
    // Get existing orders and find a delivered one
    const ordersRes = await app.request("/api/orders");
    const ordersBody = await ordersRes.json();
    const deliveredOrder = ordersBody.orders.find((o: any) => o.status === "Delivered");
    expect(deliveredOrder).toBeDefined();

    const res = await app.request(`/api/orders/${deliveredOrder.order_id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain("confirmed");
  });

  test("POST /api/orders/:order_id/confirm returns 404 for unknown order", async () => {
    const res = await app.request("/api/orders/UNKNOWN/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Order not found");
  });

  test("POST /api/orders/:order_id/confirm returns 400 for non-delivered order", async () => {
    // Get existing orders and find a non-delivered one
    const ordersRes = await app.request("/api/orders");
    const ordersBody = await ordersRes.json();
    const nonDelivered = ordersBody.orders.find((o: any) => o.status !== "Delivered");
    expect(nonDelivered).toBeDefined();

    const res = await app.request(`/api/orders/${nonDelivered.order_id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error", "Only delivered orders can be confirmed");
  });

  // ---------------------------------------------------------------------------
  // Malformed JSON body
  // ---------------------------------------------------------------------------

  test("Malformed JSON body returns 400 { error: 'Invalid JSON body' }", async () => {
    const res = await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Invalid JSON body" });
  });

  // ---------------------------------------------------------------------------
  // Cart quantity increment
  // ---------------------------------------------------------------------------

  test("POST /api/cart/add increments quantity for existing item", async () => {
    // Add same item twice
    await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001" }),
    });
    const res = await app.request("/api/cart/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: "prod_0001" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cart_count).toBe(2);

    // Verify cart has one item with quantity 2
    const cartRes = await app.request("/api/cart");
    const cartBody = await cartRes.json();
    expect(cartBody.items.length).toBe(1);
    expect(cartBody.items[0].quantity).toBe(2);
  });

  // ---------------------------------------------------------------------------
  // Search page numeric filter validation
  // ---------------------------------------------------------------------------

  test("GET /search with invalid min_price returns 400", async () => {
    const res = await app.request("/search?min_price=abc");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).toContain("min_price");
  });

  // ---------------------------------------------------------------------------
  // Search page vs API parity — shared ListProductsQuerySchema validation
  // ---------------------------------------------------------------------------

  test("GET /search with invalid sort returns 400 (parity with /api/products)", async () => {
    const pageRes = await app.request("/search?sort=bogus");
    const apiRes = await app.request("/api/products?sort=bogus");
    expect(pageRes.status).toBe(400);
    expect(apiRes.status).toBe(400);
    const pageBody = await pageRes.json();
    const apiBody = await apiRes.json();
    expect(pageBody.error).toContain("sort");
    expect(apiBody.error).toContain("sort");
  });

  test("GET /search with invalid page silently falls back to 1 (parity with /api/products)", async () => {
    const pageRes = await app.request("/search?q=watch&page=abc");
    expect(pageRes.status).toBe(200);
    expect(pageRes.headers.get("content-type")).toContain("text/html");
    const text = await pageRes.text();
    expect(text).toContain("Search Results");

    const apiRes = await app.request("/api/products?q=watch&page=abc");
    expect(apiRes.status).toBe(200);
    const apiBody = await apiRes.json();
    expect(apiBody.current_page).toBe(1);
  });

  test("GET /search with empty min_price returns 200 (parity with /api/products)", async () => {
    const pageRes = await app.request("/search?q=watch&min_price=");
    expect(pageRes.status).toBe(200);
    expect(pageRes.headers.get("content-type")).toContain("text/html");

    const apiRes = await app.request("/api/products?q=watch&min_price=");
    expect(apiRes.status).toBe(200);
  });

  test("GET /search with valid sort returns 200 HTML", async () => {
    for (const sort of ["similarity", "price_asc", "price_desc", "rating"]) {
      const res = await app.request(`/search?q=watch&sort=${sort}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
    }
  });

  test("GET /search with missing sort defaults to similarity (parity with /api/products)", async () => {
    const pageRes = await app.request("/search?q=watch");
    expect(pageRes.status).toBe(200);
    expect(pageRes.headers.get("content-type")).toContain("text/html");

    const apiRes = await app.request("/api/products?q=watch");
    expect(apiRes.status).toBe(200);
    const apiBody = await apiRes.json();
    expect(apiBody.current_page).toBe(1);
  });
});
