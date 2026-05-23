import { JsonStore } from "mock-lib";
import type { CartItem, Order, Product, UserData } from "../types.js";
import { DEFAULT_USER } from "./defaults.js";

// Data directory for persistent shop state. The per-task startup script creates this
// directory (mkdir -p, chown mock:mock, chmod 700) and creates verifier-compatible
// symlinks: /tmp/mosi_shop_{orders,cart,user}.json -> /var/lib/mock-data/shop/*.json

let _store: JsonStore | null = null;
let _storeDir: string | null = null;

function getStore(): JsonStore {
  const dataDir = process.env.MOCK_DATA_DIR || "/var/lib/mock-data/shop";
  // Auto-recreate when the data directory changes so parallel / sequential
  // factory calls with different env vars never alias the same store.
  if (!_store || _storeDir !== dataDir) {
    _store = new JsonStore({ dir: dataDir });
    _storeDir = dataDir;
  }
  return _store;
}

/** Reset the internal store instance (used by tests to pick up new env vars) */
export function resetStore(): void {
  _store = null;
  _storeDir = null;
}

export function loadCart(): CartItem[] {
  return getStore().read<CartItem[]>("mosi_shop_cart", []);
}

export function saveCart(cart: CartItem[]): void {
  getStore().write("mosi_shop_cart", cart);
}

export function clearCart(): void {
  saveCart([]);
}

export function userExists(): boolean {
  return getStore().read<UserData | null>("mosi_shop_user", null) !== null;
}

export function loadUser(): UserData {
  return getStore().read<UserData>("mosi_shop_user", DEFAULT_USER);
}

export function saveUser(user: UserData): void {
  getStore().write("mosi_shop_user", user);
}

export function loadOrders(): Order[] {
  return getStore().read<Order[]>("mosi_shop_orders", []);
}

export function saveOrders(orders: Order[]): void {
  getStore().write("mosi_shop_orders", orders);
}

// ---------------------------------------------------------------------------
// Mutable stock state — C-axis (Runtime Adaptability) only
//
// In-memory Map loaded once from products JSON at startup. Not synced to disk.
// Only active when TASK_NAME is a C-axis task that needs stock mutation.
// ---------------------------------------------------------------------------

const stockMap = new Map<string, number>();

export function initStockFromProducts(products: Product[]): void {
  for (const p of products) {
    if (p.stock_quantity != null && p.stock_quantity > 0) {
      stockMap.set(p.id, p.stock_quantity);
    }
  }
}

export function getStock(productId: string): number | undefined {
  return stockMap.get(productId);
}

export function setStock(productId: string, quantity: number): void {
  stockMap.set(productId, quantity);
}

export function decrementStock(productId: string, qty: number = 1): number {
  const current = stockMap.get(productId) ?? 0;
  const next = Math.max(0, current - qty);
  stockMap.set(productId, next);
  return next;
}

export function resetStock(): void {
  stockMap.clear();
}
