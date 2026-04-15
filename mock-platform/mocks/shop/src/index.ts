/**
 * Shop mock service — E-Commerce Mosi Shop
 *
 * Port of the Python FastAPI app (watch-shop/environment/shop-app/backend/app.py)
 * to Bun + Hono. Implements 19 endpoints: 5 HTML pages (TSX), 14 API routes (JSON),
 * plus the health endpoint from mock-lib.
 *
 * Uses JSON file storage via mock-lib's JsonStore for cart, user, and order data.
 * Products are loaded from sample_products.json at startup.
 */

import { createMockApp, startServer, JsonStore, registerStaticAssets } from "mock-lib";
import type { AppEnv } from "mock-lib";
import { Hono } from "hono";
import type { Context } from "hono";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Product {
  id: string;
  title: string;
  price: number;
  rating: number;
  rating_count: string;
  image_url: string;
  sponsored?: boolean;
  best_seller?: boolean;
  overall_pick?: boolean;
  limited_time?: boolean;
  discounted?: boolean;
  low_stock?: boolean;
  stock_quantity?: number | null;
}

interface CartItem {
  id: string;
  title: string;
  price: number;
  rating: number;
  image_url: string;
  quantity: number;
}

interface OrderItem {
  product_id: string;
  title: string;
  price: number;
  quantity: number;
  image_url: string;
}

interface Order {
  order_id: string;
  user_id: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  create_time: string;
  shipping_address: string;
}

interface PaymentMethod {
  type: string;
  account: string;
  balance?: string;
}

interface UserData {
  username: string;
  gender: string;
  address: string;
  email: string;
  phone: string;
  payment_methods?: PaymentMethod[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PRODUCTS_PER_PAGE = 30;

const DEFAULT_USER: UserData = {
  username: "Peter Griffin",
  gender: "Male",
  address: "1234 Innovation Drive, San Francisco, CA 94105, USA",
  email: "peter.griffin@example.com",
  phone: "11111111111",
  payment_methods: [
    { type: "gift card", account: "GIFT-****-****-7892", balance: "$50.00" },
    { type: "paypal account", account: "peter.griffin@email.com" },
    { type: "credit card", account: "Visa ending in 4532" },
  ],
};

/** Products loaded into memory at startup (read-only) */
let allProducts: Product[] = [];

// ---------------------------------------------------------------------------
// Data persistence
// ---------------------------------------------------------------------------

const store = new JsonStore({ dir: "/var/lib/mock-data/shop" });

function loadProducts(): Product[] {
  return allProducts;
}

function loadCart(): CartItem[] {
  return store.read<CartItem[]>("cart", []);
}

function saveCart(cart: CartItem[]): void {
  store.write("cart", cart);
}

function clearCart(): void {
  saveCart([]);
}

function loadUser(): UserData {
  return store.read<UserData>("user", DEFAULT_USER);
}

function saveUser(user: UserData): void {
  store.write("user", user);
}

function loadOrders(): Order[] {
  return store.read<Order[]>("orders", []);
}

function saveOrders(orders: Order[]): void {
  store.write("orders", orders);
}

// ---------------------------------------------------------------------------
// Search algorithm — faithful port of Python calculate_relevance_score()
// ---------------------------------------------------------------------------

function calculateRelevanceScore(product: Product, query: string): number {
  if (!query || !query.trim()) return 0.0;

  const queryLower = query.toLowerCase().trim();
  const title = (product.title ?? "").toLowerCase();
  if (!title) return 0.0;

  let score = 0.0;

  // Exact title match
  if (queryLower === title) {
    score += 100.0;
  }

  // Tokenize query and title using \w+ (matches [a-zA-Z0-9_])
  const queryWords = queryLower.match(/\w+/g) ?? [];
  const titleWords = title.match(/\w+/g) ?? [];

  if (!queryWords.length || !titleWords.length) return score;

  // Count word frequencies
  const titleWordCount = new Map<string, number>();
  for (const w of titleWords) {
    titleWordCount.set(w, (titleWordCount.get(w) ?? 0) + 1);
  }

  // Exact word matches
  let matchedWords = 0;
  for (const qWord of queryWords) {
    if ((titleWords as readonly string[]).includes(qWord)) {
      matchedWords++;
      const positions: number[] = [];
      for (let i = 0; i < titleWords.length; i++) {
        if (titleWords[i] === qWord) positions.push(i);
      }
      if (positions.length > 0) {
        const positionBonus = Math.max(0, 10 - positions[0]);
        score += 20 + positionBonus;
      }
    }
  }

  // Partial word matches (substring, 3+ chars only)
  for (const qWord of queryWords) {
    if (qWord.length >= 3) {
      for (const tWord of titleWords) {
        if (qWord !== tWord && tWord.includes(qWord)) {
          score += 10;
          break;
        }
      }
    }
  }

  // Coverage: percentage of query words found
  const coverage = matchedWords / queryWords.length;
  score += coverage * 30;

  // Word frequency boost
  for (const qWord of queryWords) {
    const freq = titleWordCount.get(qWord) ?? 0;
    if (freq > 0) {
      score += Math.min(freq * 5, 20);
    }
  }

  // Product quality boosts
  score += (product.rating ?? 0) * 2;
  if (product.best_seller) score += 15;
  if (product.overall_pick) score += 15;

  return score;
}

function searchProducts(
  products: Product[],
  query: string,
  minRelevance = 10.0,
): [Product, number][] {
  if (!query || !query.trim()) {
    return products.map((p) => [p, 0.0] as [Product, number]);
  }

  const scored: [Product, number][] = [];
  for (const product of products) {
    const relevance = calculateRelevanceScore(product, query);
    if (relevance >= minRelevance) {
      scored.push([product, relevance]);
    }
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored;
}

interface FilterOptions {
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: string;
  useSearch?: boolean;
}

function filterAndSortProducts(products: Product[], opts: FilterOptions): Product[] {
  const { query, minPrice, maxPrice, minRating, sortBy = "similarity", useSearch = true } = opts;

  let productsWithScores = new Map<string, number>();

  // Step 1: Apply search
  if (query && query.trim() && useSearch) {
    let scored = searchProducts(products, query, 10.0);
    productsWithScores = new Map(scored.map(([p, s]) => [p.id, s]));
    products = scored.map(([p]) => p);

    // If no results, retry with lower threshold
    if (!products.length) {
      scored = searchProducts(loadProducts(), query, 0.0);
      productsWithScores = new Map(scored.map(([p, s]) => [p.id, s]));
      products = scored.map(([p]) => p);
    }
  }

  // Step 2: Apply filters
  if (minPrice != null) products = products.filter((p) => (p.price ?? 0) >= minPrice!);
  if (maxPrice != null) products = products.filter((p) => (p.price ?? 0) <= maxPrice!);
  if (minRating != null) products = products.filter((p) => (p.rating ?? 0) >= minRating!);

  // Step 3: Sort
  if (sortBy === "similarity") {
    if (productsWithScores.size > 0) {
      products.sort((a, b) => (productsWithScores.get(b.id) ?? 0) - (productsWithScores.get(a.id) ?? 0));
    } else {
      products.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
  } else if (sortBy === "price_asc") {
    products.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  } else if (sortBy === "price_desc") {
    products.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  } else if (sortBy === "rating") {
    products.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  return products;
}

// ---------------------------------------------------------------------------
// TSX Templates
// ---------------------------------------------------------------------------

function renderPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
<nav class="navbar">
<a href="/">Home</a>
<a href="/cart">Cart</a>
<a href="/profile">Profile</a>
<a href="/orders">Orders</a>
</nav>
${body}
</body>
</html>`;
}

// --- search.html (home page) ---
function renderSearch(): string {
  return renderPage("Mosi Shop", `
<div class="container">
<h1>Welcome to Mosi Shop</h1>
<p>Search for products:</p>
<form action="/search" method="get" class="search-form">
<input type="text" name="q" placeholder="Search products...">
<button type="submit">Search</button>
</form>
</div>`);
}

// --- results.html ---
function renderResults(params: {
  query: string;
  products: Product[];
  currentSort: string;
  currentPage: number;
  totalPages: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
}): string {
  const { query, products, currentSort, currentPage, totalPages, minPrice, maxPrice, minRating } = params;

  const productCards = products.map((p) => {
    const rating = p.rating ?? 0;
    const fullStars = Math.floor(rating);
    const remainingStars = Math.max(0, 5 - fullStars);
    let starHtml = '<span class="stars">';
    for (let i = 0; i < fullStars; i++) starHtml += '<span class="star full">&#9733;</span>';
    for (let i = 0; i < remainingStars; i++) starHtml += '<span class="star empty">&#9734;</span>';
    starHtml += "</span>";

    let tagsHtml = "";
    if (p.sponsored) tagsHtml += '<span class="tag sponsored">Sponsored</span>';
    if (p.best_seller) tagsHtml += '<span class="tag best-seller">Best Seller</span>';
    if (p.overall_pick) tagsHtml += '<span class="tag overall-pick">Overall Pick</span>';
    if (p.limited_time) tagsHtml += '<span class="tag limited-time">Limited Time</span>';
    if (p.discounted) tagsHtml += '<span class="tag discounted">Discounted</span>';
    if (p.low_stock) tagsHtml += '<span class="tag low-stock">Low Stock</span>';

    return `<div class="product-card">
<div class="product-image"><img src="${escHtml(p.image_url)}" alt="${escHtml(p.title)}"></div>
<div class="product-info">
<h3 class="product-title"><a href="/product/${escHtml(p.id)}">${escHtml(p.title)}</a></h3>
<div class="product-rating">${starHtml} <span class="rating-text">${rating.toFixed(1)}</span>${p.rating_count ? ` (${escHtml(p.rating_count)})` : ""}</div>
<div class="product-price">$${p.price.toFixed(2)}</div>
${tagsHtml ? `<div class="product-tags">${tagsHtml}</div>` : ""}
<button class="add-to-cart-btn" onclick="addToCart('${escHtml(p.id)}')">Add to Cart</button>
</div>
</div>`;
  }).join("\n");

  // Sort dropdown
  const sortOptions = ["similarity", "price_asc", "price_desc", "rating"]
    .map((s) => `<option value="${s}"${s === currentSort ? " selected" : ""}>${s === "price_asc" ? "Price: Low to High" : s === "price_desc" ? "Price: High to Low" : s === "rating" ? "Rating" : "Relevance"}</option>`)
    .join("");

  // Pagination
  let paginationHtml = "";
  if (totalPages > 1) {
    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      if (p === currentPage) {
        pages.push(`<span class="page current">${p}</span>`);
      } else {
        const params = new URLSearchParams({ q: query, sort: currentSort, page: String(p) });
        if (minPrice != null) params.set("min_price", String(minPrice));
        if (maxPrice != null) params.set("max_price", String(maxPrice));
        if (minRating != null) params.set("min_rating", String(minRating));
        pages.push(`<a href="/search?${params}" class="page">${p}</a>`);
      }
    }
    paginationHtml = `<div class="pagination">${pages.join(" ")}</div>`;
  }

  const body = `<div class="container">
<h1>Search Results</h1>
<p class="meta">Query: <code>${escHtml(query)}</code></p>
<form action="/search" method="get" class="search-form">
<input type="text" name="q" value="${escHtml(query)}">
<select name="sort">${sortOptions}</select>
<input type="number" name="min_price" placeholder="Min price" step="0.01" value="${minPrice ?? ""}">
<input type="number" name="max_price" placeholder="Max price" step="0.01" value="${maxPrice ?? ""}">
<input type="number" name="min_rating" placeholder="Min rating" step="0.1" min="0" max="5" value="${minRating ?? ""}">
<button type="submit">Search</button>
</form>
${products.length > 0
    ? `<div class="product-list">${productCards}</div>`
    : '<p>No products found matching your search.</p>'
}
${paginationHtml}
</div>`;

  return renderPage(`Search: ${query}`, body);
}

// --- cart.html ---
function renderCart(cartItems: CartItem[], total: number): string {
  const totalItems = cartItems.reduce((s, i) => s + i.quantity, 0);

  const itemsHtml = cartItems.map((item) => `
<div class="cart-item">
<span class="cart-item-title">${escHtml(item.title)}</span>
<span class="cart-item-price">$${item.price.toFixed(2)}</span>
<span class="cart-item-quantity">
<button onclick="updateCart('${escHtml(item.id)}', ${item.quantity - 1})">-</button>
<span>${item.quantity}</span>
<button onclick="updateCart('${escHtml(item.id)}', ${item.quantity + 1})">+</button>
</span>
<span class="cart-item-subtotal">$${(item.price * item.quantity).toFixed(2)}</span>
<button onclick="removeFromCart('${escHtml(item.id)}')">Remove</button>
</div>`).join("\n");

  const body = `<div class="container">
<h1>Shopping Cart</h1>
${cartItems.length > 0
    ? `${itemsHtml}
<div class="cart-total">
<p>Items: ${totalItems}</p>
<p>Total: $${total.toFixed(2)}</p>
<button class="checkout-btn" onclick="checkout()">Checkout</button>
<button class="clear-btn" onclick="clearCartAction()">Clear Cart</button>
</div>`
    : "<p>Your cart is empty.</p>"
}
</div>`;

  return renderPage("Cart", body);
}

// --- profile.html ---
function renderProfile(user: UserData): string {
  const paymentMethodsHtml = (user.payment_methods ?? []).map((method) => {
    const typeLower = method.type.toLowerCase();
    let icon = "&#128179;"; // credit card default
    if (typeLower.includes("gift")) icon = "&#127873;";
    else if (typeLower.includes("paypal")) icon = "&#10697;";
    return `<div class="payment-method">
<span class="payment-icon">${icon}</span>
<span class="payment-type">${escHtml(method.type)}</span>
<span class="payment-account">${escHtml(method.account)}</span>
${method.balance ? `<span class="payment-balance">${escHtml(method.balance)}</span>` : ""}
</div>`;
  }).join("\n");

  const body = `<div class="container">
<h1>Profile</h1>
<div class="profile-info">
<div class="profile-field"><label>Username:</label> <span>${escHtml(user.username)}</span></div>
<div class="profile-field"><label>Gender:</label> <span>${escHtml(user.gender)}</span></div>
<div class="profile-field"><label>Email:</label> <span>${escHtml(user.email)}</span></div>
<div class="profile-field"><label>Phone:</label> <span>${escHtml(user.phone)}</span></div>
<div class="profile-field"><label>Address:</label> <span>${escHtml(user.address)}</span></div>
</div>
${user.payment_methods && user.payment_methods.length > 0
    ? `<h2>Payment Methods</h2><div class="payment-methods">${paymentMethodsHtml}</div>`
    : ""}
</div>`;

  return renderPage(`${user.username}'s Profile`, body);
}

// --- orders.html ---
function renderOrders(user: UserData, orders: Order[]): string {
  const ordersHtml = orders.map((order) => {
    const itemsHtml = order.items.map((item) => `
<div class="order-item">
<span>${escHtml(item.title)}</span>
<span>Qty: ${item.quantity}</span>
<span>$${item.price.toFixed(2)}</span>
</div>`).join("\n");

    let actionHtml = "";
    if (order.status === "Delivered") {
      actionHtml = `<button onclick="confirmOrder('${escHtml(order.order_id)}')">Confirm Receipt</button>
<button onclick="returnOrder('${escHtml(order.order_id)}')">Return</button>`;
    } else if (["Pending Shipment", "Shipped", "Completed"].includes(order.status)) {
      actionHtml = `<button onclick="returnOrder('${escHtml(order.order_id)}')">Return</button>`;
    }

    return `<div class="order">
<div class="order-header">
<span class="order-id">Order: ${escHtml(order.order_id)}</span>
<span class="order-status ${order.status.toLowerCase().replace(/\s/g, "-")}">${escHtml(order.status)}</span>
<span class="order-date">${escHtml(order.create_time)}</span>
<span class="order-total">$${order.total_amount.toFixed(2)}</span>
</div>
<div class="order-items">${itemsHtml}</div>
<div class="order-actions">${actionHtml}</div>
</div>`;
  }).join("\n");

  const body = `<div class="container">
<h1>Order History</h1>
<p class="meta">${escHtml(user.username)} — ${orders.length} orders</p>
${orders.length > 0 ? ordersHtml : "<p>No orders found.</p>"}
</div>`;

  return renderPage("Orders", body);
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

function registerRoutes(app: Hono<AppEnv>): void {
  // Sentinel route for binary isolation verification (AC-1.1).
  app.get("/__mock_sentinel__/shop", (c) =>
    c.json({ mock: "shop", sentinel: true }),
  );

  // Static assets from /opt/mock/static/shop/ at /static/
  registerStaticAssets(app, { dir: "/opt/mock/static/shop", prefix: "/static" });

  // HTML pages
  app.get("/", (c) => c.html(renderSearch()));

  app.get("/search", (c) => {
    const query = c.req.query("q") ?? "";
    const sort = c.req.query("sort") ?? "similarity";
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
    const minPrice = c.req.query("min_price") ? parseFloat(c.req.query("min_price")!) : undefined;
    const maxPrice = c.req.query("max_price") ? parseFloat(c.req.query("max_price")!) : undefined;
    const minRating = c.req.query("min_rating") ? parseFloat(c.req.query("min_rating")!) : undefined;

    let currentProducts: Product[] = [];
    let totalPages = 0;

    if (query) {
      const allResults = filterAndSortProducts(loadProducts(), {
        query,
        minPrice,
        maxPrice,
        minRating,
        sortBy: sort,
        useSearch: true,
      });
      totalPages = Math.ceil(allResults.length / PRODUCTS_PER_PAGE) || 0;
      const startIdx = (page - 1) * PRODUCTS_PER_PAGE;
      currentProducts = allResults.slice(startIdx, startIdx + PRODUCTS_PER_PAGE);
    }

    return c.html(
      renderResults({
        query,
        products: currentProducts,
        currentSort: sort,
        currentPage: page,
        totalPages,
        minPrice,
        maxPrice,
        minRating,
      }),
    );
  });

  app.get("/cart", (c) => {
    const cartItems = loadCart();
    const total = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
    return c.html(renderCart(cartItems, total));
  });

  app.get("/profile", (c) => {
    return c.html(renderProfile(loadUser()));
  });

  app.get("/orders", (c) => {
    return c.html(renderOrders(loadUser(), loadOrders()));
  });

  // API routes
  app.get("/api/products", (c) => {
    const query = c.req.query("q") ?? "";
    const sort = c.req.query("sort") ?? "similarity";
    const page = Math.max(1, parseInt(c.req.query("page") ?? "1", 10) || 1);
    const minPrice = c.req.query("min_price") ? parseFloat(c.req.query("min_price")!) : undefined;
    const maxPrice = c.req.query("max_price") ? parseFloat(c.req.query("max_price")!) : undefined;
    const minRating = c.req.query("min_rating") ? parseFloat(c.req.query("min_rating")!) : undefined;

    const filtered = filterAndSortProducts(loadProducts(), {
      query,
      minPrice,
      maxPrice,
      minRating,
      sortBy: sort,
      useSearch: true,
    });
    const totalProducts = filtered.length;
    const totalPgs = Math.ceil(totalProducts / PRODUCTS_PER_PAGE) || 0;
    const startIdx = (page - 1) * PRODUCTS_PER_PAGE;
    const pageProducts = filtered.slice(startIdx, startIdx + PRODUCTS_PER_PAGE);

    return c.json({
      products: pageProducts,
      total_products: totalProducts,
      total_pages: totalPgs,
      current_page: page,
      products_per_page: PRODUCTS_PER_PAGE,
    });
  });

  app.get("/api/product/:product_id", (c) => {
    const pid = c.req.param("product_id");
    const product = loadProducts().find((p) => p.id === pid);
    if (!product) return c.json({ error: "Product not found" }, 404);
    return c.json(product);
  });

  app.post("/api/cart/add", async (c) => {
    const body = await c.req.json<{ product_id?: string }>();
    const productId = body.product_id;
    if (!productId) return c.json({ success: false, message: "product_id required" });

    const product = loadProducts().find((p) => p.id === productId);
    if (!product) return c.json({ success: false, message: "Product not found" });

    const cart = loadCart();
    const existing = cart.find((item) => item.id === productId);
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
    saveCart(cart);

    return c.json({
      success: true,
      message: `Added ${product.title.slice(0, 50)}... to cart`,
      cart_count: cart.reduce((s, i) => s + i.quantity, 0),
    });
  });

  app.get("/api/cart", (c) => {
    const cart = loadCart();
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    return c.json({
      items: cart,
      total,
      count: cart.reduce((s, i) => s + i.quantity, 0),
    });
  });

  app.delete("/api/cart/remove/:product_id", (c) => {
    const pid = c.req.param("product_id");
    const cart = loadCart().filter((item) => item.id !== pid);
    saveCart(cart);
    return c.json({
      success: true,
      message: "Item removed from cart",
      cart_count: cart.reduce((s, i) => s + i.quantity, 0),
    });
  });

  app.put("/api/cart/update", async (c) => {
    const body = await c.req.json<{ product_id?: string; quantity?: number }>();
    const productId = body.product_id;
    const quantity = body.quantity ?? 1;

    const cart = loadCart();
    const item = cart.find((i) => i.id === productId);
    if (item) {
      if (quantity <= 0) {
        const idx = cart.indexOf(item);
        if (idx >= 0) cart.splice(idx, 1);
      } else {
        item.quantity = quantity;
      }
    }
    saveCart(cart);

    return c.json({
      success: true,
      message: "Cart updated",
      cart_count: cart.reduce((s, i) => s + i.quantity, 0),
    });
  });

  app.post("/api/cart/clear", (c) => {
    clearCart();
    return c.json({ success: true, message: "Cart cleared" });
  });

  app.post("/api/checkout", (c) => {
    const cart = loadCart();
    if (!cart.length) return c.json({ success: false, message: "Cart is empty" });

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
      items: cart.map((ci) => ({
        product_id: ci.id,
        title: ci.title,
        price: ci.price,
        quantity: ci.quantity,
        image_url: ci.image_url,
      })),
      total_amount: Math.round(totalAmount * 100) / 100,
      status: "Pending Shipment",
      create_time: new Date().toISOString().replace("T", " ").slice(0, 19),
      shipping_address: user.address ?? DEFAULT_USER.address,
    };

    orders.push(order);
    orders.sort((a, b) => b.order_id.localeCompare(a.order_id));
    saveOrders(orders);
    clearCart();

    return c.json({
      success: true,
      message: "Order placed successfully!",
      order_id: orderId,
    });
  });

  app.get("/api/user", (c) => {
    return c.json(loadUser());
  });

  app.post("/api/user/update", async (c) => {
    const body = await c.req.json<{ field?: string; value?: string }>();
    const field = body.field;
    const value = body.value;
    if (!field || !value) return c.json({ success: false, message: "Field and value are required" });

    const allowed = ["username", "gender", "email", "phone", "address"];
    if (!allowed.includes(field)) return c.json({ success: false, message: "Invalid field" });

    const user: Record<string, unknown> = loadUser() as unknown as Record<string, unknown>;
    user[field] = value;
    saveUser(user as unknown as UserData);

    return c.json({ success: true, message: `${field} updated successfully` });
  });

  app.get("/api/orders", (c) => {
    const orders = loadOrders();
    return c.json({ orders, total: orders.length });
  });

  app.post("/api/orders/:order_id/return", (c) => {
    const oid = c.req.param("order_id");
    const orders = loadOrders();
    const order = orders.find((o) => o.order_id === oid);
    if (!order) return c.json({ success: false, message: "Order not found" });

    const allowedStatuses = ["Pending Shipment", "Delivered", "Shipped", "Completed"];
    if (!allowedStatuses.includes(order.status)) {
      return c.json({ success: false, message: "This order cannot be returned" });
    }

    order.status = "Returning";
    saveOrders(orders);
    return c.json({
      success: true,
      message: "Return request received. Customer service will contact you regarding the return.",
    });
  });

  app.post("/api/orders/:order_id/confirm", (c) => {
    const oid = c.req.param("order_id");
    const orders = loadOrders();
    const order = orders.find((o) => o.order_id === oid);
    if (!order) return c.json({ success: false, message: "Order not found" });
    if (order.status !== "Delivered") {
      return c.json({ success: false, message: "Only delivered orders can be confirmed" });
    }

    order.status = "Completed";
    saveOrders(orders);
    return c.json({ success: true, message: "Order confirmed as completed." });
  });
}

// ---------------------------------------------------------------------------
// Order seeding — port of Python initialize_orders()
// ---------------------------------------------------------------------------

function seedOrders(): void {
  // Only seed if no orders exist
  if (loadOrders().length > 0) return;

  const products = loadProducts();
  if (!products.length) return;

  const productMap = new Map(products.map((p) => [p.id, p]));

  const orderConfigs = [
    { product_id: "prod_0009", order_num: 7, days_ago: 0, status: "Delivered" },
    { product_id: "prod_0017", order_num: 6, days_ago: 1, status: "Pending Shipment" },
    { product_id: "prod_0031", order_num: 5, days_ago: 2, status: "Shipped" },
    { product_id: "prod_0015", order_num: 4, days_ago: 3, status: "Delivered" },
    { product_id: "prod_0018", order_num: 3, days_ago: 5, status: "Completed" },
    { product_id: "prod_0020", order_num: 2, days_ago: 7, status: "Pending Shipment" },
    { product_id: "prod_0001", order_num: 1, days_ago: 10, status: "Shipped" },
  ];

  const orders: Order[] = [];
  for (const config of orderConfigs) {
    const product = productMap.get(config.product_id);
    if (!product) continue;

    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - config.days_ago);

    orders.push({
      order_id: `ORD${String(config.order_num).padStart(6, "0")}`,
      user_id: "Peter Griffin",
      items: [{
        product_id: product.id,
        title: product.title,
        price: product.price,
        quantity: 1,
        image_url: product.image_url,
      }],
      total_amount: Math.round(product.price * 100) / 100,
      status: config.status,
      create_time: orderDate.toISOString().replace("T", " ").slice(0, 19),
      shipping_address: "1234 Innovation Drive, San Francisco, CA 94105, USA",
    });
  }

  orders.sort((a, b) => b.order_id.localeCompare(a.order_id));
  saveOrders(orders);
}

function seedUser(): void {
  // Only seed if no user exists
  const existing = store.read<UserData | null>("user", null);
  if (!existing) {
    saveUser({ ...DEFAULT_USER });
  }
}

// ---------------------------------------------------------------------------
// App bootstrap
// ---------------------------------------------------------------------------

const app = createMockApp({
  name: "shop-mosi-backend",
  port: 1234,
  healthResponse: { status: "healthy", service: "shop-mosi-backend" },
  routes: registerRoutes,
});

// Load products from static assets at startup
try {
  const productsPath = "/opt/mock/static/shop/products.json";
  const content = Bun.file(productsPath);
  allProducts = await content.json();
  console.log(`mock-shop: loaded ${allProducts.length} products from ${productsPath}`);
} catch (err) {
  console.error(`mock-shop: failed to load products, falling back to empty list`, err);
  allProducts = [];
}

startServer(app, {
  seed() {
    seedUser();
    seedOrders();
  },
});
