# Shop Internal Documentation

This document covers implementation details of the `mock-shop` service that are not part of the public API surface. For API routes and request/response schemas, see the auto-generated OpenAPI spec at `dist/openapi/shop.json`.

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

### PaymentMethod

```typescript
interface PaymentMethod {
  type: string;
  account: string;
  balance?: string;
}
```
