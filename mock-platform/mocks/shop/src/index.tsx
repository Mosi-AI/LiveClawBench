/** @jsxImportSource hono/jsx */
/**
 * Shop mock service — E-Commerce Mosi Shop
 *
 * Port of the legacy Python shop-app backend to Bun + Hono.
 * (Original: tasks/{task}/environment/shop-app/backend/app.py, removed in Plan 2.5)
 *
 * Implements 19 endpoints: 5 HTML pages (TSX), 14 API routes (JSON),
 * plus the health endpoint from mock-lib.
 *
 * Uses JSON file storage via mock-lib's JsonStore for cart, user, and order data.
 * Products are loaded from sample_products.json at startup.
 */

import { createMockApp, createRoute, startServer, registerStaticAssets, err } from "mock-lib";
import type { MockAppV2 } from "mock-lib";
import { z } from "zod";
import {
  filterAndSortProducts,
  type FilterOptions,
} from "./search-algorithm.js";
import {
  ListProductsQuerySchema,
} from "./schemas.js";
import type { Product } from "./types.js";
import { loadProducts, seedUser, seedOrders } from "./data/seed.js";
import { loadCart, loadUser, loadOrders, resetStore } from "./data/store.js";
import { HomePage } from "./components/home-page.js";
import { ResultsPage } from "./components/results-page.js";
import { CartPage } from "./components/cart-page.js";
import { ProfilePage } from "./components/profile-page.js";
import { OrdersPage } from "./components/orders-page.js";
import { registerProductRoutes } from "./routes/products.js";
import { registerCartRoutes } from "./routes/cart.js";
import { registerCheckoutRoutes } from "./routes/checkout.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerUserRoutes } from "./routes/user.js";

const PRODUCTS_PER_PAGE = 30;

export function createShopApp(options?: { productsPath?: string }): MockAppV2 {
  // Reset the shared store so each factory call picks up the current env vars
  // (needed for tests that set MOCK_DATA_DIR before creating the app)
  resetStore();

  // Per-instance product array — isolated from other factory calls
  let allProducts: Product[] = [];

  const mockApp = createMockApp({
    name: "shop-mosi-backend",
    port: 1234,
    healthResponse: { status: "healthy", service: "shop-mosi-backend" },
    openApi: {
      enabled: true,
      title: "Shop Mock API",
      version: "1.0.0",
    },
  });

  const { config, app } = mockApp;

  // Static assets from /opt/mock/static/shop/ at /static/
  registerStaticAssets(app, { dir: "/opt/mock/static/shop", prefix: "/static" });

  // Sentinel route for binary isolation verification.
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/shop",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ ok: z.boolean() }),
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(sentinelRoute, (c) => c.json({ ok: true }));

  // HTML pages
  app.page("/", (c) => c.html(<HomePage />));

  app.page("/search", (c) => {
    const rawQuery = {
      q: c.req.query("q"),
      sort: c.req.query("sort"),
      page: c.req.query("page"),
      min_price: c.req.query("min_price"),
      max_price: c.req.query("max_price"),
      min_rating: c.req.query("min_rating"),
    };
    const parsed = ListProductsQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      return c.json(err(message), 400);
    }
    const { q = "", sort, page, min_price, max_price, min_rating } = parsed.data;

    let currentProducts: Product[] = [];
    let totalPages = 0;

    if (q) {
      const allResults = filterAndSortProducts(allProducts, {
        query: q,
        minPrice: min_price,
        maxPrice: max_price,
        minRating: min_rating,
        sortBy: sort,
        useSearch: true,
      });
      totalPages = Math.ceil(allResults.length / PRODUCTS_PER_PAGE) || 0;
      const startIdx = (page - 1) * PRODUCTS_PER_PAGE;
      currentProducts = allResults.slice(startIdx, startIdx + PRODUCTS_PER_PAGE);
    }

    return c.html(
      <ResultsPage
        query={q}
        products={currentProducts}
        currentSort={sort}
        currentPage={page}
        totalPages={totalPages}
        minPrice={min_price}
        maxPrice={max_price}
        minRating={min_rating}
      />,
    );
  });

  app.page("/cart", (c) => {
    const cartItems = loadCart();
    const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
    return c.html(<CartPage cartItems={cartItems} total={total} />);
  });

  app.page("/profile", (c) => {
    return c.html(<ProfilePage user={loadUser()} />);
  });

  app.page("/orders", (c) => {
    return c.html(<OrdersPage user={loadUser()} orders={loadOrders()} />);
  });

  // API routes
  registerProductRoutes(app, () => allProducts);
  registerCartRoutes(app, () => allProducts);
  registerCheckoutRoutes(app);
  registerOrderRoutes(app);
  registerUserRoutes(app);

  return {
    ...mockApp,
    seed: async () => {
      allProducts = await loadProducts(options?.productsPath);
      seedUser();
      seedOrders(allProducts);
    },
  };
}

// ---------------------------------------------------------------------------
// Module-level: start server only when main
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const app = createShopApp();
  startServer(app);
}
