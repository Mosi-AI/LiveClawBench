import type { Product, Order } from "../types.js";
import { userExists, loadOrders, saveOrders, saveUser } from "./store.js";
import { DEFAULT_USER } from "./defaults.js";

export async function loadProducts(productsPath?: string): Promise<Product[]> {
  const path = productsPath ?? process.env.MOCK_PRODUCTS_PATH ?? "/opt/mock/static/shop/products.json";
  try {
    const content = Bun.file(path);
    const products = (await content.json()) as Product[];
    console.log(`mock-shop: loaded ${products.length} products from ${path}`);
    return products;
  } catch (err) {
    console.error(`mock-shop: FATAL: failed to load products.json`, err);
    throw new Error(`Failed to load products.json from ${path}: ${err}`);
  }
}

export function seedUser(): void {
  // Only seed if no user exists
  if (!userExists()) {
    saveUser({ ...DEFAULT_USER });
  }
}

// ---------------------------------------------------------------------------
// Order seeding — port of Python initialize_orders()
// ---------------------------------------------------------------------------

export function seedOrders(products: Product[]): void {
  // Only seed if no orders exist
  if (loadOrders().length > 0) return;

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
