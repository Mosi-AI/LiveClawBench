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

import { createMockApp, createRoute, startServer, JsonStore, registerStaticAssets } from "mock-lib";
import type { AppEnv, MockAppV2 } from "mock-lib";
import { html, raw } from "hono/html";
import type { FC, Child } from "hono/jsx";
import { z } from "zod";
import {
  filterAndSortProducts,
  type FilterOptions,
} from "./search-algorithm.js";
import {
  ListProductsQuerySchema,
  AddToCartBodySchema,
  UpdateCartBodySchema,
  UpdateUserBodySchema,
  ListProductsResponseSchema,
  CartResponseSchema,
  CartMutationResponseSchema,
  CheckoutResponseSchema,
  ListOrdersResponseSchema,
  GenericSuccessResponseSchema,
  ProductSchema,
  UserDataSchema,
  OrderSchema,
} from "./schemas.js";

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
  id?: string;
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
// Factory
// ---------------------------------------------------------------------------

export function createShopApp(): MockAppV2 {
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

  // Data directory for persistent shop state. The per-task startup script creates this
  // directory (mkdir -p, chown mock:mock, chmod 700) and creates verifier-compatible
  // symlinks: /tmp/mosi_shop_{orders,cart,user}.json -> /var/lib/mock-data/shop/*.json
  const DATA_DIR = process.env.MOCK_DATA_DIR || "/var/lib/mock-data/shop";

  const store = new JsonStore({ dir: DATA_DIR });

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
  // Order seeding — port of Python initialize_orders()
  // ---------------------------------------------------------------------------

  function seedOrders(): void {
    // Only seed if no orders exist
    if (loadOrders().length > 0) return;

    const products = allProducts;
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

  async function loadProducts(): Promise<void> {
    const productsPath = process.env.MOCK_PRODUCTS_PATH ?? "/opt/mock/static/shop/products.json";
    try {
      const content = Bun.file(productsPath);
      allProducts = await content.json();
      console.log(`mock-shop: loaded ${allProducts.length} products from ${productsPath}`);
    } catch (err) {
      console.error(`mock-shop: FATAL: failed to load products.json`, err);
      process.exit(1);
    }
  }

  // ---------------------------------------------------------------------------
  // HTML helpers
  // ---------------------------------------------------------------------------

  function escHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function escJs(s: string): string {
    return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
  }

  // ---------------------------------------------------------------------------
  // TSX Template Components
  // ---------------------------------------------------------------------------

  const Layout: FC<{ title: string; children: Child; scripts?: string; styles?: string }> = ({ title, children, scripts, styles }) => {
    return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<link rel="stylesheet" href="/static/css/style.css">
${styles ? html`<style>${raw(styles)}</style>` : ""}
</head>
<body>
<nav class="navbar">
<a href="/">Home</a>
<a href="/cart">Cart (<span id="cart-count">0</span>)</a>
<a href="/profile">Profile</a>
<a href="/orders">Orders</a>
</nav>
${children}
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
${scripts ? html`<script>${raw(scripts)}</script>` : ""}
</body>
</html>`;
  };

  // --- search.html (home page) ---
  const HomePage: FC = () => {
    return <Layout title="Mosi Shop">
      <div class="container">
        <h1>Welcome to Mosi Shop</h1>
        <p>Search for products:</p>
        <form action="/search" method="get" class="search-form">
          <input type="text" name="q" placeholder="Search products..." />
          <button type="submit">Search</button>
        </form>
      </div>
    </Layout>;
  };

  // --- results.html ---
  const ProductCard: FC<{ product: Product }> = ({ product: p }) => {
    const rating = p.rating ?? 0;
    const fullStars = Math.floor(rating);
    const remainingStars = Math.max(0, 5 - fullStars);
    const stars: Child[] = [];
    for (let i = 0; i < fullStars; i++) stars.push(<span class="star full">&#9733;</span>);
    for (let i = 0; i < remainingStars; i++) stars.push(<span class="star empty">&#9734;</span>);

    const tags: Child[] = [];
    if (p.sponsored) tags.push(<span class="tag sponsored">Sponsored</span>);
    if (p.best_seller) tags.push(<span class="tag best-seller">Best Seller</span>);
    if (p.overall_pick) tags.push(<span class="tag overall-pick">Overall Pick</span>);
    if (p.limited_time) tags.push(<span class="tag limited-time">Limited Time</span>);
    if (p.discounted) tags.push(<span class="tag discounted">Discounted</span>);
    if (p.low_stock) tags.push(<span class="tag low-stock">Low Stock</span>);

    return <div class="product-card">
      <div class="product-image"><img src={p.image_url} alt={p.title} /></div>
      <div class="product-info">
        <h3 class="product-title">{p.title}</h3>
        <div class="product-rating">
          <span class="stars">{stars}</span>{" "}
          <span class="rating-text">{rating.toFixed(1)}</span>
          {p.rating_count ? ` (${p.rating_count})` : ""}
        </div>
        <div class="product-price">{`$${p.price.toFixed(2)}`}</div>
        {tags.length > 0 ? <div class="product-tags">{tags}</div> : null}
        <button class="add-to-cart-btn" onclick={`addToCart('${escJs(p.id)}')`}>Add to Cart</button>
      </div>
    </div>;
  };

  const SORT_LABELS: Record<string, string> = {
    similarity: "Relevance",
    price_asc: "Price: Low to High",
    price_desc: "Price: High to Low",
    rating: "Rating",
  };

  const ResultsPage: FC<{
    query: string;
    products: Product[];
    currentSort: string;
    currentPage: number;
    totalPages: number;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
  }> = ({ query, products, currentSort, currentPage, totalPages, minPrice, maxPrice, minRating }) => {
    const sortOptions: Child[] = ["similarity", "price_asc", "price_desc", "rating"].map((s) =>
      <option value={s} selected={s === currentSort}>{SORT_LABELS[s]}</option>
    );

    const pagination: Child[] = [];
    if (totalPages > 1) {
      for (let p = 1; p <= totalPages; p++) {
        if (p === currentPage) {
          pagination.push(<span class="page current">{p}</span>);
        } else {
          const params = new URLSearchParams({ q: query, sort: currentSort, page: String(p) });
          if (minPrice != null) params.set("min_price", String(minPrice));
          if (maxPrice != null) params.set("max_price", String(maxPrice));
          if (minRating != null) params.set("min_rating", String(minRating));
          pagination.push(<a href={`/search?${params}`} class="page">{p}</a>);
        }
      }
    }

    return <Layout title={`Search: ${query}`} scripts={`
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
}`}>
      <div class="container">
        <h1>Search Results</h1>
        <p class="meta">Query: <code>{query}</code></p>
        <form action="/search" method="get" class="search-form">
          <input type="text" name="q" value={query} />
          <select name="sort">{sortOptions}</select>
          <input type="number" name="min_price" placeholder="Min price" step="0.01" value={minPrice ?? ""} />
          <input type="number" name="max_price" placeholder="Max price" step="0.01" value={maxPrice ?? ""} />
          <input type="number" name="min_rating" placeholder="Min rating" step="0.1" min="0" max="5" value={minRating ?? ""} />
          <button type="submit">Search</button>
        </form>
        {products.length > 0
          ? <div class="product-list">{products.map((p) => <ProductCard product={p} />)}</div>
          : <p>No products found matching your search.</p>
        }
        {pagination.length > 0 ? <div class="pagination">{pagination}</div> : null}
      </div>
    </Layout>;
  };

  // --- cart.html ---
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

  const CartPage: FC<{ cartItems: CartItem[]; total: number }> = ({ cartItems, total }) => {
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


  // --- profile.html ---

  const PROFILE_CSS = `.profile-container { max-width: 900px; margin: 40px auto; padding: 0 20px; }
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
`;

  const PROFILE_JS = `function editField(fieldName, currentValue) {
  var labels = { username: 'Username', gender: 'Gender', email: 'Email', phone: 'Phone', address: 'Delivery Address' };
  var isTextarea = fieldName === 'address';
  var modal = document.createElement('div');
  modal.className = 'edit-modal active';
  modal.id = 'editModal';
  modal.onclick = closeEditModal;
  var content = document.createElement('div');
  content.className = 'edit-modal-content';
  content.onclick = function(e) { e.stopPropagation(); };
  var header = document.createElement('div');
  header.className = 'edit-modal-header';
  var title = document.createElement('div');
  title.className = 'edit-modal-title';
  title.textContent = 'Edit ' + labels[fieldName];
  var closeBtn = document.createElement('button');
  closeBtn.className = 'edit-modal-close';
  closeBtn.textContent = '\u00D7';
  closeBtn.onclick = closeEditModal;
  header.appendChild(title);
  header.appendChild(closeBtn);
  var body = document.createElement('div');
  body.className = 'edit-modal-body';
  var label = document.createElement('div');
  label.className = 'edit-field-label';
  label.textContent = labels[fieldName];
  var input;
  if (isTextarea) {
    input = document.createElement('textarea');
  } else {
    input = document.createElement('input');
    input.type = 'text';
  }
  input.className = 'edit-field-input';
  input.id = 'editInput';
  input.value = currentValue;
  body.appendChild(label);
  body.appendChild(input);
  var actions = document.createElement('div');
  actions.className = 'edit-modal-actions';
  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'cancel-btn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = closeEditModal;
  var saveBtn = document.createElement('button');
  saveBtn.className = 'save-btn';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = function() { saveField(fieldName); };
  actions.appendChild(cancelBtn);
  actions.appendChild(saveBtn);
  content.appendChild(header);
  content.appendChild(body);
  content.appendChild(actions);
  modal.appendChild(content);
  document.body.appendChild(modal);
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
  var modal = document.createElement('div');
  modal.className = 'payment-modal active';
  modal.id = 'paymentModal';
  modal.onclick = closeModal;
  var content = document.createElement('div');
  content.className = 'modal-content';
  content.onclick = function(e) { e.stopPropagation(); };
  var header = document.createElement('div');
  header.className = 'modal-header';
  var title = document.createElement('div');
  title.className = 'modal-title';
  title.textContent = type;
  var closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.textContent = '\u00D7';
  closeBtn.onclick = closeModal;
  header.appendChild(title);
  header.appendChild(closeBtn);
  var body = document.createElement('div');
  body.className = 'modal-body';
  var accountRow = document.createElement('div');
  accountRow.className = 'detail-row';
  var accountLabel = document.createElement('span');
  accountLabel.className = 'detail-label';
  accountLabel.textContent = 'Account';
  var accountValue = document.createElement('span');
  accountValue.className = 'detail-value';
  accountValue.textContent = account;
  accountRow.appendChild(accountLabel);
  accountRow.appendChild(accountValue);
  body.appendChild(accountRow);
  if (balance) {
    var balanceRow = document.createElement('div');
    balanceRow.className = 'detail-row';
    var balanceLabel = document.createElement('span');
    balanceLabel.className = 'detail-label';
    balanceLabel.textContent = 'Balance';
    var balanceValue = document.createElement('span');
    balanceValue.className = 'detail-value';
    balanceValue.style.color = '#1e8e3e';
    balanceValue.textContent = balance;
    balanceRow.appendChild(balanceLabel);
    balanceRow.appendChild(balanceValue);
    body.appendChild(balanceRow);
  }
  var statusRow = document.createElement('div');
  statusRow.className = 'detail-row';
  var statusLabel = document.createElement('span');
  statusLabel.className = 'detail-label';
  statusLabel.textContent = 'Status';
  var statusValue = document.createElement('span');
  statusValue.className = 'detail-value';
  statusValue.style.color = '#1e8e3e';
  statusValue.textContent = '\u2713 Active';
  statusRow.appendChild(statusLabel);
  statusRow.appendChild(statusValue);
  body.appendChild(statusRow);
  content.appendChild(header);
  content.appendChild(body);
  modal.appendChild(content);
  document.body.appendChild(modal);
}

function closeModal(event) {
  if (event && event.target !== event.currentTarget) return;
  var modal = document.getElementById('paymentModal');
  if (modal) modal.remove();
}`;

  function getPaymentIcon(type: string): string {
    const t = type.toLowerCase();
    if (t.includes("gift")) return "\u{1F381}";
    return "\u{1F4B3}";
  }

  const ProfilePage: FC<{ user: UserData }> = ({ user }) => {
    const payments = user.payment_methods ?? [];
    const editIcon = "\u270F\uFE0F";
    const paymentItems: Child[] = payments.map((m) => {
      const icon = getPaymentIcon(m.type);
      const balanceArg = m.balance ? `, '${escJs(m.balance)}'` : "";
      return <div class="payment-item" onclick={`showPaymentDetail('${escJs(m.type)}', '${escJs(m.account)}'${balanceArg})`}>
        <div class="payment-icon">{icon}</div>
        <div class="payment-info">
          <div class="payment-type">{m.type}</div>
          <div class="payment-account">{m.account}</div>
        </div>
        <div class="payment-arrow">{"\u203A"}</div>
      </div>;
    });

    return <Layout title={`${user.username}'s Profile`} styles={PROFILE_CSS} scripts={PROFILE_JS}>
      <div class="profile-container">
        <div class="profile-header">
          <div class="profile-avatar">{"\u{1F464}"}</div>
          <h1>{user.username}</h1>
          <div class="profile-subtitle">Welcome to your profile</div>
        </div>
        <div class="profile-content">
          <div class="profile-section">
            <h2>Basic Information</h2>
            <div class="info-grid">
              <div class="info-item">
                <label>Username</label>
                <div class="info-value" id="username-display">
                  <span class="value-text">{user.username}</span>
                  <button class="edit-btn" onclick={`editField('username', '${escJs(user.username)}')`}>{editIcon}</button>
                </div>
              </div>
              <div class="info-item">
                <label>Gender</label>
                <div class="info-value" id="gender-display">
                  <span class="value-text">{user.gender}</span>
                  <button class="edit-btn" onclick={`editField('gender', '${escJs(user.gender)}')`}>{editIcon}</button>
                </div>
              </div>
              <div class="info-item">
                <label>Email</label>
                <div class="info-value" id="email-display">
                  <span class="value-text">{user.email}</span>
                  <button class="edit-btn" onclick={`editField('email', '${escJs(user.email)}')`}>{editIcon}</button>
                </div>
              </div>
              <div class="info-item">
                <label>Phone</label>
                <div class="info-value" id="phone-display">
                  <span class="value-text">{user.phone}</span>
                  <button class="edit-btn" onclick={`editField('phone', '${escJs(user.phone)}')`}>{editIcon}</button>
                </div>
              </div>
              <div class="info-item full-width">
                <label>Delivery Address</label>
                <div class="info-value" id="address-display">
                  <span class="value-text">{user.address}</span>
                  <button class="edit-btn" onclick={`editField('address', '${escJs(user.address)}')`}>{editIcon}</button>
                </div>
              </div>
            </div>
          </div>
          {payments.length > 0
            ? <div class="profile-section">
                <h2>Payment Methods</h2>
                <div class="payment-methods">{paymentItems}</div>
              </div>
            : null}
          <div class="profile-actions">
            <a href="/orders" class="action-btn primary"><span class="action-icon">{"\u{1F4E6}"}</span><span>View My Orders</span></a>
            <a href="/cart" class="action-btn"><span class="action-icon">{"\u{1F6D2}"}</span><span>View Shopping Cart</span></a>
            <a href="/" class="action-btn"><span class="action-icon">{"\u{1F3E0}"}</span><span>Back to Home</span></a>
          </div>
        </div>
      </div>
    </Layout>;
  };

  // --- orders.html ---

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

  const OrdersPage: FC<{ user: UserData; orders: Order[] }> = ({ user, orders }) => {
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
        <p class="meta">{`${user.username} \u2014 ${orders.length} orders`}</p>
        {orders.length > 0 ? orderElements : <p>No orders found.</p>}
      </div>
    </Layout>;
  };

  // ---------------------------------------------------------------------------
  // App creation
  // ---------------------------------------------------------------------------

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
      return c.json({ error: message }, 400);
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
        sortBy: sort as FilterOptions["sortBy"],
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

  // GET /api/products
  const listProductsRoute = createRoute({
    method: "get",
    path: "/api/products",
    summary: "List products",
    request: {
      query: ListProductsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ListProductsResponseSchema,
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listProductsRoute, (c) => {
    const { q, sort, page, min_price, max_price, min_rating } = c.req.valid("query");

    const filtered = filterAndSortProducts(allProducts, {
      query: q,
      minPrice: min_price,
      maxPrice: max_price,
      minRating: min_rating,
      sortBy: sort as FilterOptions["sortBy"],
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

  // GET /api/product/:product_id
  const getProductRoute = createRoute({
    method: "get",
    path: "/api/product/{product_id}",
    summary: "Get a single product",
    request: {
      params: z.object({ product_id: z.string() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ProductSchema,
          },
        },
        description: "OK",
      },
      404: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(getProductRoute, (c): any => {
    const { product_id } = c.req.valid("param");
    const product = allProducts.find((p) => p.id === product_id);
    if (!product) return c.json({ error: "Product not found" }, 404);
    return c.json(product);
  });

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
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Product not found",
      },
    },
  });

  app.openApiRoute(addToCartRoute, (c): any => {
    const { product_id } = c.req.valid("json");

    const product = allProducts.find((p) => p.id === product_id);
    if (!product) return c.json({ error: "Product not found" }, 404);

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
    } catch (err) {
      console.error("mock-shop: failed to save cart", err);
      return c.json({ error: "Failed to save cart" }, 500);
    }

    return c.json({
      success: true,
      message: `Added ${product.title.slice(0, 50)}... to cart`,
      cart_count: cart.reduce((s, i) => s + i.quantity, 0),
    });
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
    return c.json({
      items: cart,
      total,
      count: cart.reduce((s, i) => s + i.quantity, 0),
    });
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
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Item not found",
      },
    },
  });

  app.openApiRoute(removeFromCartRoute, (c): any => {
    const { product_id } = c.req.valid("param");
    const cart = loadCart();
    const itemExists = cart.some((item) => item.id === product_id);
    if (!itemExists) return c.json({ error: "Item not found in cart" }, 404);
    const updatedCart = cart.filter((item) => item.id !== product_id);
    try {
      saveCart(updatedCart);
    } catch (err) {
      console.error("mock-shop: failed to save cart", err);
      return c.json({ error: "Failed to save cart" }, 500);
    }
    return c.json({
      success: true,
      message: "Item removed from cart",
      cart_count: updatedCart.reduce((s, i) => s + i.quantity, 0),
    });
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
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Item not found",
      },
    },
  });

  app.openApiRoute(updateCartRoute, (c): any => {
    const { product_id, quantity } = c.req.valid("json");

    const cart = loadCart();
    const item = cart.find((i) => i.id === product_id);
    if (!item) return c.json({ error: "Item not found in cart" }, 404);
    if (quantity <= 0) {
      const idx = cart.indexOf(item);
      if (idx >= 0) cart.splice(idx, 1);
    } else {
      item.quantity = quantity;
    }
    try {
      saveCart(cart);
    } catch (err) {
      console.error("mock-shop: failed to save cart", err);
      return c.json({ error: "Failed to save cart" }, 500);
    }

    return c.json({
      success: true,
      message: "Cart updated",
      cart_count: cart.reduce((s, i) => s + i.quantity, 0),
    });
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
    },
  });

  app.openApiRoute(clearCartRoute, (c): any => {
    try {
      clearCart();
    } catch (err) {
      console.error("mock-shop: failed to clear cart", err);
      return c.json({ error: "Failed to clear cart" }, 500);
    }
    return c.json({ success: true, message: "Cart cleared" });
  });

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
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Cart is empty",
      },
    },
  });

  app.openApiRoute(checkoutRoute, (c): any => {
    const cart = loadCart();
    if (!cart.length) return c.json({ error: "Cart is empty" }, 400);

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
    } catch (err) {
      console.error("mock-shop: failed to save orders", err);
      return c.json({ error: "Failed to save order" }, 500);
    }
    try {
      clearCart();
    } catch (err) {
      console.error("mock-shop: order saved but cart clear failed", err);
      // Order is already persisted; returning 500 per write-failure contract
      return c.json({ error: "Order saved but cart clear failed" }, 500);
    }

    return c.json({
      success: true,
      message: "Order placed successfully!",
      order_id: orderId,
    });
  });

  // GET /api/user
  const getUserRoute = createRoute({
    method: "get",
    path: "/api/user",
    summary: "Get user profile",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: UserDataSchema,
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(getUserRoute, (c) => {
    return c.json(loadUser());
  });

  // POST /api/user/update
  const updateUserRoute = createRoute({
    method: "post",
    path: "/api/user/update",
    summary: "Update user profile",
    request: {
      body: {
        content: {
          "application/json": {
            schema: UpdateUserBodySchema,
          },
        },
      },
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
    },
  });

  app.openApiRoute(updateUserRoute, (c): any => {
    const { field, value } = c.req.valid("json");

    const user = loadUser();
    (user as unknown as Record<string, unknown>)[field] = value;
    try {
      saveUser(user);
    } catch (err) {
      console.error("mock-shop: failed to save user", err);
      return c.json({ error: "Failed to save user profile" }, 500);
    }

    return c.json({ success: true, message: `${field} updated successfully` });
  });

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
    return c.json({ orders, total: orders.length });
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
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Order not found",
      },
      400: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Cannot return this order",
      },
    },
  });

  app.openApiRoute(returnOrderRoute, (c): any => {
    const { order_id } = c.req.valid("param");
    const orders = loadOrders();
    const order = orders.find((o) => o.order_id === order_id);
    if (!order) return c.json({ error: "Order not found" }, 404);

    const allowedStatuses = ["Pending Shipment", "Delivered", "Shipped", "Completed"];
    if (!allowedStatuses.includes(order.status)) {
      return c.json({ error: "This order cannot be returned" }, 400);
    }

    order.status = "Returning";
    try {
      saveOrders(orders);
    } catch (err) {
      console.error("mock-shop: failed to save orders", err);
      return c.json({ error: "Failed to update order" }, 500);
    }
    return c.json({
      success: true,
      message: "Return request received. Customer service will contact you regarding the return.",
    });
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
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Order not found",
      },
      400: {
        content: {
          "application/json": {
            schema: z.object({ error: z.string() }),
          },
        },
        description: "Only delivered orders can be confirmed",
      },
    },
  });

  app.openApiRoute(confirmOrderRoute, (c): any => {
    const { order_id } = c.req.valid("param");
    const orders = loadOrders();
    const order = orders.find((o) => o.order_id === order_id);
    if (!order) return c.json({ error: "Order not found" }, 404);
    if (order.status !== "Delivered") {
      return c.json({ error: "Only delivered orders can be confirmed" }, 400);
    }

    order.status = "Completed";
    try {
      saveOrders(orders);
    } catch (err) {
      console.error("mock-shop: failed to save orders", err);
      return c.json({ error: "Failed to update order" }, 500);
    }
    return c.json({ success: true, message: "Order confirmed as completed." });
  });

  return {
    ...mockApp,
    seed: async () => {
      await loadProducts();
      seedUser();
      seedOrders();
    },
  } as MockAppV2 & { seed(): Promise<void> };
}

// ---------------------------------------------------------------------------
// Module-level: load products and start server only when main
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const app = createShopApp();
  startServer(app, {
    seed: (app as unknown as { seed(): Promise<void> }).seed,
  });
}
