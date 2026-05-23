import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetInjectionState } from "mock-lib";
import { createShopApp } from "../src/index";
import type { OpenAPIApp } from "mock-lib";

const PRODUCTS_PATH = join(
  import.meta.dir,
  "../../../static/shop/sample_products.json",
);

describe("shop C-axis fault injection", () => {
  let dataDir: string;
  let shop: ReturnType<typeof createShopApp>;
  let app: OpenAPIApp;

  beforeEach(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "shop-c-test-"));
    process.env.MOCK_DATA_DIR = dataDir;
    process.env.MOCK_PRODUCTS_PATH = PRODUCTS_PATH;
    resetInjectionState();
  });

  afterEach(() => {
    try { rmSync(dataDir, { recursive: true, force: true }); } catch {}
    delete process.env.MOCK_DATA_DIR;
    delete process.env.MOCK_PRODUCTS_PATH;
    delete process.env.TASK_NAME;
  });

  // ---------------------------------------------------------------------------
  // C1 — watch-shop-stockout
  // ---------------------------------------------------------------------------

  describe("C1: watch-shop-stockout", () => {
    beforeEach(async () => {
      process.env.TASK_NAME = "watch-shop-stockout";
      shop = createShopApp();
      app = shop.app;
      await shop.seed!();
    });

    test("first checkout with watch item returns 409 SOLD_OUT", async () => {
      // Add a watch item to cart
      const addRes = await app.request("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod_0068" }),
      });
      expect(addRes.status).toBe(200);

      // First checkout should fail with SOLD_OUT
      const checkoutRes = await app.request("/api/checkout", { method: "POST" });
      expect(checkoutRes.status).toBe(409);
      const body = await checkoutRes.json();
      expect(body.success).toBe(false);
      expect(body.message).toContain("sold out");
    });

    test("second checkout succeeds after removing sold-out watch (one-shot)", async () => {
      // Add watch to cart, checkout (fails with SOLD_OUT)
      await app.request("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod_0068" }),
      });
      const first = await app.request("/api/checkout", { method: "POST" });
      expect(first.status).toBe(409);

      // Remove the sold-out watch from cart
      await app.request("/api/cart/remove/prod_0068", { method: "DELETE" });

      // Add a different item for the retry
      await app.request("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod_0001" }),
      });

      // Second checkout should succeed
      const second = await app.request("/api/checkout", { method: "POST" });
      expect(second.status).toBe(200);
      const body = await second.json();
      expect(body.data.order_id).toBeDefined();
      // Should NOT be the fake order ID
      expect(body.data.order_id).not.toBe("ORD-FAKE-123");

      // Final order must NOT contain the sold-out watch
      const ordersRes = await app.request("/api/orders");
      const orders = await ordersRes.json();
      const order = orders.data.orders.find((o: any) => o.order_id === body.data.order_id);
      expect(order).toBeDefined();
      const itemIds = order.items.map((i: any) => i.id);
      expect(itemIds).not.toContain("prod_0068");
    });

    test("checkout blocks when runtime stock is 0 after C1 fires", async () => {
      // First checkout with watch triggers C1 and sets stock to 0
      await app.request("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod_0068" }),
      });
      const first = await app.request("/api/checkout", { method: "POST" });
      expect(first.status).toBe(409);

      // Cart still has the watch (checkout failed, cart unchanged)
      // Attempt checkout again — stock is now 0, should be blocked
      const second = await app.request("/api/checkout", { method: "POST" });
      expect(second.status).toBe(409);
      const body = await second.json();
      expect(body.message).toContain("sold out");
    });

    test("stock state reflects sold-out after C1 fires", async () => {
      // Check initial stock for the watch product
      const prodRes = await app.request("/api/product/prod_0068");
      expect(prodRes.status).toBe(200);
      const prodBefore = await prodRes.json();
      expect(prodBefore.data.stock_quantity).toBeGreaterThan(0);

      // Add and attempt checkout
      await app.request("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod_0068" }),
      });
      await app.request("/api/checkout", { method: "POST" });

      // Product listing should now show stock_quantity = 0
      const prodAfter = await app.request("/api/product/prod_0068");
      const prodData = await prodAfter.json();
      expect(prodData.data.stock_quantity).toBe(0);
    });

    test("non-watch cart items bypass C1 stockout", async () => {
      // Add a non-watch item
      await app.request("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod_0001" }),
      });

      // Checkout should succeed (no watch in cart → falls through)
      const res = await app.request("/api/checkout", { method: "POST" });
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // C2 — watch-shop-silent-fail
  // ---------------------------------------------------------------------------

  describe("C2: watch-shop-silent-fail", () => {
    beforeEach(async () => {
      process.env.TASK_NAME = "watch-shop-silent-fail";
      shop = createShopApp();
      app = shop.app;
      await shop.seed!();
    });

    test("first checkout returns fake success", async () => {
      await app.request("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod_0068" }),
      });

      const res = await app.request("/api/checkout", { method: "POST" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.order_id).toBe("ORD-FAKE-123");
    });

    test("order not persisted after silent fail", async () => {
      await app.request("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod_0068" }),
      });
      await app.request("/api/checkout", { method: "POST" });

      // Orders should not contain ORD-FAKE-123
      const ordersRes = await app.request("/api/orders");
      const orders = await ordersRes.json();
      const ids = orders.data.orders.map((o: any) => o.order_id);
      expect(ids).not.toContain("ORD-FAKE-123");
    });

    test("cart not cleared after silent fail", async () => {
      await app.request("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod_0068" }),
      });
      await app.request("/api/checkout", { method: "POST" });

      // Cart should still have items
      const cartRes = await app.request("/api/cart");
      const cart = await cartRes.json();
      expect(cart.data.items.length).toBeGreaterThan(0);
    });

    test("second checkout persists normally (one-shot)", async () => {
      await app.request("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod_0068" }),
      });
      // First: silent fail
      await app.request("/api/checkout", { method: "POST" });

      // Second: real persist
      const res = await app.request("/api/checkout", { method: "POST" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.order_id).not.toBe("ORD-FAKE-123");

      // Order should now be persisted
      const ordersRes = await app.request("/api/orders");
      const orders = await ordersRes.json();
      const ids = orders.data.orders.map((o: any) => o.order_id);
      expect(ids).toContain(body.data.order_id);
    });
  });

  // ---------------------------------------------------------------------------
  // Non-C task — should not trigger any fault injection
  // ---------------------------------------------------------------------------

  describe("non-C task: no fault injection", () => {
    beforeEach(async () => {
      process.env.TASK_NAME = "watch-shop";
      shop = createShopApp();
      app = shop.app;
      await shop.seed!();
    });

    test("checkout works normally for non-C task", async () => {
      await app.request("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod_0068" }),
      });
      const res = await app.request("/api/checkout", { method: "POST" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.order_id).not.toBe("ORD-FAKE-123");
    });
  });
});
