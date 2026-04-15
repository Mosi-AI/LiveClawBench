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

// Data directory for persistent shop state. The per-task startup script creates this
// directory (mkdir -p, chown mock:mock, chmod 700) and creates verifier-compatible
// symlinks: /tmp/mosi_shop_{orders,cart,user}.json -> /var/lib/mock-data/shop/*.json
const DATA_DIR = process.env.MOCK_DATA_DIR || "/var/lib/mock-data/shop";

const store = new JsonStore({ dir: DATA_DIR });

function loadProducts(): Product[] {
  return allProducts;
}

function loadCart(): CartItem[] {
  return store.read<CartItem[]>("mosi_shop_cart", []);
}

function saveCart(cart: CartItem[]): void {
  store.write("mosi_shop_cart", cart);
}

function clearCart(): void {
  saveCart([]);
}

function loadUser(): UserData {
  return store.read<UserData>("mosi_shop_user", DEFAULT_USER);
}

function saveUser(user: UserData): void {
  store.write("mosi_shop_user", user);
}

function loadOrders(): Order[] {
  return store.read<Order[]>("mosi_shop_orders", []);
}

function saveOrders(orders: Order[]): void {
  store.write("mosi_shop_orders", orders);
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
<a href="/cart">Cart (<span id="cart-count">0</span>)</a>
<a href="/profile">Profile</a>
<a href="/orders">Orders</a>
</nav>
${body}
<script>
async function updateCartCount() {
  try {
    const response = await fetch('/api/cart');
    const data = await response.json();
    const el = document.getElementById('cart-count');
    if (el) el.textContent = data.count;
  } catch (error) {
    console.error('Error fetching cart count:', error);
  }
}
updateCartCount();
</script>
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
<h3 class="product-title">${escHtml(p.title)}</h3>
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

  return renderPage(`Search: ${query}`, body + `
<script>
async function addToCart(productId) {
  try {
    const response = await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId })
    });
    const data = await response.json();
    if (data.success) {
      const el = document.getElementById('cart-count');
      if (el) el.textContent = data.cart_count;
    } else {
      alert('Failed to add item to cart');
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
    alert('Error adding item to cart');
  }
}
</script>`);
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

  return renderPage("Cart", body + `
<script>
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
}
</script>`);
}

// --- profile.html ---
function renderProfile(user: UserData): string {
  const paymentItemsHtml = (user.payment_methods ?? []).map((method) => {
    const typeLower = method.type.toLowerCase();
    let icon = "&#128179;";
    if (typeLower.includes("gift")) icon = "&#127873;";
    else if (typeLower.includes("paypal")) icon = "&#128179;";
    else if (typeLower.includes("credit")) icon = "&#128179;";
    const balanceArg = method.balance ? `, '${escHtml(method.balance)}'` : "";
    return `<div class="payment-item" onclick="showPaymentDetail('${escHtml(method.type)}', '${escHtml(method.account)}'${balanceArg})">
<div class="payment-icon">${icon}</div>
<div class="payment-info">
<div class="payment-type">${escHtml(method.type)}</div>
<div class="payment-account">${escHtml(method.account)}</div>
</div>
<div class="payment-arrow">&rsaquo;</div>
</div>`;
  }).join("\n");

  const body = `<div class="profile-container">
<div class="profile-header">
<div class="profile-avatar">&#128100;</div>
<h1>${escHtml(user.username)}</h1>
<div class="profile-subtitle">Welcome to your profile</div>
</div>
<div class="profile-content">
<div class="profile-section">
<h2>Basic Information</h2>
<div class="info-grid">
<div class="info-item">
<label>Username</label>
<div class="info-value" id="username-display">
<span class="value-text">${escHtml(user.username)}</span>
<button class="edit-btn" onclick="editField('username', '${escHtml(user.username)}')">&#9999;&#65039;</button>
</div>
</div>
<div class="info-item">
<label>Gender</label>
<div class="info-value" id="gender-display">
<span class="value-text">${escHtml(user.gender)}</span>
<button class="edit-btn" onclick="editField('gender', '${escHtml(user.gender)}')">&#9999;&#65039;</button>
</div>
</div>
<div class="info-item">
<label>Email</label>
<div class="info-value" id="email-display">
<span class="value-text">${escHtml(user.email)}</span>
<button class="edit-btn" onclick="editField('email', '${escHtml(user.email)}')">&#9999;&#65039;</button>
</div>
</div>
<div class="info-item">
<label>Phone</label>
<div class="info-value" id="phone-display">
<span class="value-text">${escHtml(user.phone)}</span>
<button class="edit-btn" onclick="editField('phone', '${escHtml(user.phone)}')">&#9999;&#65039;</button>
</div>
</div>
<div class="info-item full-width">
<label>Delivery Address</label>
<div class="info-value" id="address-display">
<span class="value-text">${escHtml(user.address)}</span>
<button class="edit-btn" onclick="editField('address', '${escHtml(user.address)}')">&#9999;&#65039;</button>
</div>
</div>
</div>
</div>
${user.payment_methods && user.payment_methods.length > 0
    ? `<div class="profile-section">
<h2>Payment Methods</h2>
<div class="payment-methods">${paymentItemsHtml}</div>
</div>`
    : ""}
<div class="profile-actions">
<a href="/orders" class="action-btn primary"><span class="action-icon">&#128230;</span><span>View My Orders</span></a>
<a href="/cart" class="action-btn"><span class="action-icon">&#128722;</span><span>View Shopping Cart</span></a>
<a href="/" class="action-btn"><span class="action-icon">&#127968;</span><span>Back to Home</span></a>
</div>
</div>
</div>`;

  return renderPage(`${user.username}'s Profile`, body + `
<style>
.profile-container { max-width: 900px; margin: 40px auto; padding: 0 20px; }
.profile-header { text-align: center; padding: 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; color: white; margin-bottom: 30px; }
.profile-avatar { width: 100px; height: 100px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 48px; margin: 0 auto 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.profile-header h1 { font-size: 32px; margin-bottom: 10px; }
.profile-subtitle { font-size: 16px; opacity: 0.9; }
.profile-content { background: white; border-radius: 12px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.profile-section { margin-bottom: 30px; }
.profile-section h2 { font-size: 20px; color: #232F3E; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #f0f0f0; }
.info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
.info-item { padding: 15px; background: #f8f9fa; border-radius: 8px; }
.info-item.full-width { grid-column: 1 / -1; }
.info-item label { display: block; font-size: 13px; color: #666; margin-bottom: 8px; font-weight: 500; }
.info-value { font-size: 16px; color: #232F3E; font-weight: 500; display: flex; align-items: center; gap: 10px; }
.value-text { flex: 1; }
.edit-btn { background: none; border: none; font-size: 16px; cursor: pointer; opacity: 0.5; transition: all 0.2s; padding: 4px 8px; border-radius: 4px; }
.edit-btn:hover { opacity: 1; background: #f0f0f0; transform: scale(1.1); }
.profile-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 30px; }
.action-btn { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 15px 20px; background: white; border: 2px solid #e0e0e0; border-radius: 8px; text-decoration: none; color: #232F3E; font-weight: 500; transition: all 0.3s; }
.action-btn:hover { border-color: #667eea; background: #f8f9ff; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102,126,234,0.15); }
.action-btn.primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; }
.action-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(102,126,234,0.3); }
.action-icon { font-size: 20px; }
.payment-methods { display: flex; flex-direction: column; gap: 15px; }
.payment-item { display: flex; align-items: center; padding: 15px; background: #f8f9fa; border-radius: 8px; cursor: pointer; transition: all 0.2s; border: 2px solid transparent; }
.payment-item:hover { background: #fff; border-color: #667eea; transform: translateX(5px); box-shadow: 0 2px 8px rgba(102,126,234,0.15); }
.payment-icon { font-size: 32px; margin-right: 15px; }
.payment-info { flex: 1; }
.payment-type { font-size: 16px; font-weight: 600; color: #232F3E; margin-bottom: 4px; }
.payment-account { font-size: 14px; color: #666; }
.payment-arrow { font-size: 24px; color: #999; transition: transform 0.2s; }
.payment-item:hover .payment-arrow { transform: translateX(5px); color: #667eea; }
.edit-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
.edit-modal.active { display: flex; }
.edit-modal-content { background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.2); animation: slideIn 0.3s ease; }
.edit-modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0; }
.edit-modal-title { font-size: 22px; font-weight: 600; color: #232F3E; }
.edit-modal-close { background: none; border: none; font-size: 28px; cursor: pointer; color: #999; transition: color 0.2s; }
.edit-modal-close:hover { color: #333; }
.edit-modal-body { padding: 10px 0; }
.edit-field-label { font-size: 14px; color: #666; font-weight: 500; margin-bottom: 8px; }
.edit-field-input { width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; color: #232F3E; transition: border-color 0.2s; box-sizing: border-box; }
.edit-field-input:focus { outline: none; border-color: #667eea; }
textarea.edit-field-input { resize: vertical; min-height: 100px; }
.edit-modal-actions { display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end; }
.save-btn { padding: 10px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s; }
.save-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102,126,234,0.3); }
.cancel-btn { padding: 10px 24px; background: white; color: #232F3E; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.3s; }
.cancel-btn:hover { background: #f5f5f5; }
.payment-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
.payment-modal.active { display: flex; }
.modal-content { background: white; padding: 30px; border-radius: 12px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.2); animation: slideIn 0.3s ease; }
.modal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #f0f0f0; }
.modal-title { font-size: 22px; font-weight: 600; color: #232F3E; }
.modal-close { background: none; border: none; font-size: 28px; cursor: pointer; color: #999; transition: color 0.2s; }
.modal-close:hover { color: #333; }
.modal-body { padding: 10px 0; }
.detail-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
.detail-row:last-child { border-bottom: none; }
.detail-label { font-size: 14px; color: #666; font-weight: 500; }
.detail-value { font-size: 16px; color: #232F3E; font-weight: 600; }
@keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>
<script>
function editField(fieldName, currentValue) {
  var labels = { username: 'Username', gender: 'Gender', email: 'Email', phone: 'Phone', address: 'Delivery Address' };
  var isTextarea = fieldName === 'address';
  var inputEl = isTextarea
    ? '<textarea class="edit-field-input" id="editInput">' + currentValue + '</textarea>'
    : '<input type="text" class="edit-field-input" id="editInput" value="' + currentValue + '">';
  var modalHtml = '<div class="edit-modal active" id="editModal" onclick="closeEditModal(event)">'
    + '<div class="edit-modal-content" onclick="event.stopPropagation()">'
    + '<div class="edit-modal-header"><div class="edit-modal-title">Edit ' + labels[fieldName] + '</div>'
    + '<button class="edit-modal-close" onclick="closeEditModal()">&times;</button></div>'
    + '<div class="edit-modal-body"><div class="edit-field-label">' + labels[fieldName] + '</div>' + inputEl + '</div>'
    + '<div class="edit-modal-actions"><button class="cancel-btn" onclick="closeEditModal()">Cancel</button>'
    + '<button class="save-btn" onclick="saveField(\''+fieldName+'\')">Save</button></div></div></div>';
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  setTimeout(function() {
    var inp = document.getElementById('editInput');
    if (inp) { inp.focus(); if (!isTextarea) inp.select(); }
  }, 100);
}

function closeEditModal(event) {
  if (event && event.target !== event.currentTarget) return;
  var modal = document.getElementById('editModal');
  if (modal) modal.remove();
}

async function saveField(fieldName) {
  var input = document.getElementById('editInput');
  if (!input) return;
  var newValue = input.value.trim();
  if (!newValue) { alert('Value cannot be empty'); return; }
  try {
    var response = await fetch('/api/user/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: fieldName, value: newValue })
    });
    var data = await response.json();
    if (data.success) {
      var displayEl = document.getElementById(fieldName + '-display');
      if (displayEl) {
        var valueText = displayEl.querySelector('.value-text');
        if (valueText) valueText.textContent = newValue;
      }
      closeEditModal();
    } else {
      alert('Failed to save: ' + data.message);
    }
  } catch (error) {
    console.error('Error saving field:', error);
    alert('Error saving. Please try again.');
  }
}

function showPaymentDetail(type, account, balance) {
  var modalHtml = '<div class="payment-modal active" id="paymentModal" onclick="closeModal(event)">'
    + '<div class="modal-content" onclick="event.stopPropagation()">'
    + '<div class="modal-header"><div class="modal-title">' + type + '</div>'
    + '<button class="modal-close" onclick="closeModal()">&times;</button></div>'
    + '<div class="modal-body">'
    + '<div class="detail-row"><span class="detail-label">Account</span><span class="detail-value">' + account + '</span></div>'
    + (balance ? '<div class="detail-row"><span class="detail-label">Balance</span><span class="detail-value" style="color:#1e8e3e;">' + balance + '</span></div>' : '')
    + '<div class="detail-row"><span class="detail-label">Status</span><span class="detail-value" style="color:#1e8e3e;">&#10003; Active</span></div>'
    + '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeModal(event) {
  if (event && event.target !== event.currentTarget) return;
  var modal = document.getElementById('paymentModal');
  if (modal) modal.remove();
}
</script>`);
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

  return renderPage("Orders", body + `
<script>
async function returnOrder(orderId) {
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
}
</script>`);
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
      // Python stores cart items verbatim — checkout orders keep `id` field
      // (seeded orders use `product_id`). Verifier checks ORD000008.items[0].id.
      items: cart as unknown as OrderItem[],
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
  const existing = store.read<UserData | null>("mosi_shop_user", null);
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
