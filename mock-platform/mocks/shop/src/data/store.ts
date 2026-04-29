import { JsonStore } from "mock-lib";
import type { CartItem, Order, UserData } from "../types.js";
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
