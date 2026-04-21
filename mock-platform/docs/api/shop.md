# Shop API Documentation

E-commerce mock service (`mock-shop`). Serves HTML pages for browser agents and JSON API routes for programmatic access.

> **Note:** `GET /health` is inherited from `mock-lib` and returns `{ ok: true, status: "healthy", service: "shop-mosi-backend" }`.

---

## HTML Pages

### `GET /`
Home page with product search form.

**Response:** HTML (`text/html`)

```bash
curl -s http://localhost:1234/
```

---

### `GET /search`
Search results page.

**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | — | Search query |
| `sort` | string | `similarity` | `similarity`, `price_asc`, `price_desc`, `rating` |
| `page` | integer | `1` | Page number |
| `min_price` | number | — | Minimum price filter |
| `max_price` | number | — | Maximum price filter |
| `min_rating` | number | — | Minimum rating filter |

**Response:** HTML (`text/html`)

```bash
curl -s 'http://localhost:1234/search?q=watch&sort=price_asc&page=1'
```

---

### `GET /cart`
Shopping cart page.

**Response:** HTML (`text/html`)

```bash
curl -s http://localhost:1234/cart
```

---

### `GET /profile`
User profile page with editable fields and payment methods.

**Response:** HTML (`text/html`)

```bash
curl -s http://localhost:1234/profile
```

---

### `GET /orders`
Order history page.

**Response:** HTML (`text/html`)

```bash
curl -s http://localhost:1234/orders
```

---

## API Routes

### `GET /api/products`
List and search products with pagination.

**Query Parameters:** Same as `GET /search`.

**Response:** `200 OK` (`application/json`)

```json
{
  "products": [...],
  "total_products": 42,
  "total_pages": 2,
  "current_page": 1,
  "products_per_page": 30
}
```

```bash
curl -s 'http://localhost:1234/api/products?q=watch&sort=rating&page=1'
```

---

### `GET /api/product/:product_id`
Get a single product by ID.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `product_id` | string | Product ID |

**Response:** `200 OK` — Product object  
**Error:** `404 Not Found` — `{ "error": "Product not found" }`

```bash
curl -s http://localhost:1234/api/product/prod_0001
```

---

### `POST /api/cart/add`
Add a product to the cart.

**Request Body:** `application/json`

```json
{ "product_id": "prod_0001" }
```

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Added Product Name... to cart",
  "cart_count": 3
}
```

**Errors:**
- `400 Bad Request` — Invalid JSON or missing `product_id`
- `404 Not Found` — Product does not exist
- `500 Internal Server Error` — Write failure (`{ "error": "Failed to save cart" }`)

```bash
curl -s -X POST http://localhost:1234/api/cart/add \
  -H 'Content-Type: application/json' \
  -d '{"product_id": "prod_0001"}'
```

---

### `GET /api/cart`
Get current cart contents.

**Response:** `200 OK`

```json
{
  "items": [...],
  "total": 89.97,
  "count": 3
}
```

```bash
curl -s http://localhost:1234/api/cart
```

---

### `DELETE /api/cart/remove/:product_id`
Remove an item from the cart.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `product_id` | string | Product ID to remove |

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Item removed from cart",
  "cart_count": 2
}
```

**Errors:**
- `404 Not Found` — Item not in cart
- `500 Internal Server Error` — Write failure (`{ "error": "Failed to save cart" }`)

```bash
curl -s -X DELETE http://localhost:1234/api/cart/remove/prod_0001
```

---

### `PUT /api/cart/update`
Update item quantity in the cart.

**Request Body:** `application/json`

```json
{ "product_id": "prod_0001", "quantity": 2 }
```

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Cart updated",
  "cart_count": 2
}
```

**Errors:**
- `400 Bad Request` — Invalid JSON, missing `product_id`, or invalid `quantity`
- `404 Not Found` — Item not in cart
- `500 Internal Server Error` — Write failure (`{ "error": "Failed to save cart" }`)

```bash
curl -s -X PUT http://localhost:1234/api/cart/update \
  -H 'Content-Type: application/json' \
  -d '{"product_id": "prod_0001", "quantity": 2}'
```

---

### `POST /api/cart/clear`
Clear all items from the cart.

**Response:** `200 OK`

```json
{ "success": true, "message": "Cart cleared" }
```

**Error:** `500 Internal Server Error` — Write failure (`{ "error": "Failed to clear cart" }`)

```bash
curl -s -X POST http://localhost:1234/api/cart/clear
```

---

### `POST /api/checkout`
Place an order from the current cart.

**Request Body:** `application/json` (empty object accepted)

```json
{}
```

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Order placed successfully!",
  "order_id": "ORD000008"
}
```

**Errors:**
- `400 Bad Request` — Cart is empty
- `500 Internal Server Error` — Write failure on save (`{ "error": "Failed to save order" }`)
- `500 Internal Server Error` — Order saved but cart clear failed (`{ "error": "Order saved but cart clear failed" }`)

```bash
curl -s -X POST http://localhost:1234/api/checkout \
  -H 'Content-Type: application/json' \
  -d '{}'
```

---

### `GET /api/user`
Get current user profile.

**Response:** `200 OK` — User object

```json
{
  "username": "Peter Griffin",
  "gender": "Male",
  "address": "1234 Innovation Drive, San Francisco, CA 94105, USA",
  "email": "peter.griffin@example.com",
  "phone": "11111111111",
  "payment_methods": [...]
}
```

```bash
curl -s http://localhost:1234/api/user
```

---

### `POST /api/user/update`
Update a user profile field.

**Request Body:** `application/json`

```json
{ "field": "address", "value": "5678 New St, Boston, MA 02101, USA" }
```

Allowed fields: `username`, `gender`, `email`, `phone`, `address`

**Response:** `200 OK`

```json
{ "success": true, "message": "address updated successfully" }
```

**Errors:**
- `400 Bad Request` — Invalid JSON, missing field/value, or invalid field name
- `500 Internal Server Error` — Write failure (`{ "error": "Failed to save user profile" }`)

```bash
curl -s -X POST http://localhost:1234/api/user/update \
  -H 'Content-Type: application/json' \
  -d '{"field": "address", "value": "5678 New St, Boston, MA 02101, USA"}'
```

---

### `GET /api/orders`
List all orders.

**Response:** `200 OK`

```json
{
  "orders": [...],
  "total": 7
}
```

```bash
curl -s http://localhost:1234/api/orders
```

---

### `POST /api/orders/:order_id/return`
Request a return for an order.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `order_id` | string | Order ID (e.g., `ORD000007`) |

**Response:** `200 OK`

```json
{
  "success": true,
  "message": "Return request received. Customer service will contact you regarding the return."
}
```

**Errors:**
- `404 Not Found` — Order not found
- `400 Bad Request` — Order status does not allow returns
- `500 Internal Server Error` — Write failure

```bash
curl -s -X POST http://localhost:1234/api/orders/ORD000007/return \
  -H 'Content-Type: application/json'
```

---

### `POST /api/orders/:order_id/confirm`
Confirm receipt of a delivered order.

**Path Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `order_id` | string | Order ID |

**Response:** `200 OK`

```json
{ "success": true, "message": "Order confirmed as completed." }
```

**Errors:**
- `404 Not Found` — Order not found
- `400 Bad Request` — Order is not in "Delivered" status
- `500 Internal Server Error` — Write failure

```bash
curl -s -X POST http://localhost:1234/api/orders/ORD000007/confirm \
  -H 'Content-Type: application/json'
```

---

## Data Types

### Product

```typescript
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
```

### CartItem

```typescript
interface CartItem {
  id: string;
  title: string;
  price: number;
  rating: number;
  image_url: string;
  quantity: number;
}
```

### Order

```typescript
interface Order {
  order_id: string;
  user_id: string;
  items: OrderItem[];
  total_amount: number;
  status: string;
  create_time: string;
  shipping_address: string;
}
```

### OrderItem

```typescript
interface OrderItem {
  product_id: string;
  id?: string;
  title: string;
  price: number;
  quantity: number;
  image_url: string;
}
```

### UserData

```typescript
interface UserData {
  username: string;
  gender: string;
  address: string;
  email: string;
  phone: string;
  payment_methods?: PaymentMethod[];
}
```
