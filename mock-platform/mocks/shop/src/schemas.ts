/**
 * Shop Zod schemas
 *
 * Extracted from API contracts in mocks/shop/src/index.tsx.
 * Field names match the actual API contract exactly.
 */

import { z } from "zod";
import { ErrorResponseSchema } from "mock-lib";

// ---------------------------------------------------------------------------
// Entity schemas
// ---------------------------------------------------------------------------

export const ProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number(),
  rating: z.number(),
  rating_count: z.string(),
  image_url: z.string(),
  sponsored: z.boolean().optional(),
  best_seller: z.boolean().optional(),
  overall_pick: z.boolean().optional(),
  limited_time: z.boolean().optional(),
  discounted: z.boolean().optional(),
  low_stock: z.boolean().optional(),
  stock_quantity: z.number().nullable().optional(),
});

export const CartItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number(),
  rating: z.number(),
  image_url: z.string(),
  quantity: z.number().int().min(1),
});

export const OrderItemSchema = z.object({
  product_id: z.string(),
  id: z.string().optional(),
  title: z.string(),
  price: z.number(),
  quantity: z.number(),
  image_url: z.string(),
});

export const OrderSchema = z.object({
  order_id: z.string(),
  user_id: z.string(),
  items: z.array(OrderItemSchema),
  total_amount: z.number(),
  status: z.string(),
  create_time: z.string(),
  shipping_address: z.string(),
});

export const PaymentMethodSchema = z.object({
  type: z.string(),
  account: z.string(),
  balance: z.string().optional(),
});

export const UserDataSchema = z.object({
  username: z.string(),
  gender: z.string(),
  address: z.string(),
  email: z.string(),
  phone: z.string(),
  payment_methods: z.array(PaymentMethodSchema).optional(),
});

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

// Query coercion helpers
const coercePage = z.preprocess(
  (val) => {
    if (val === undefined || val === "" || val === null) return 1;
    const n = Number(val);
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.floor(n);
  },
  z.number().int().min(1),
);

const coerceMinPrice = z.preprocess(
  (val) => {
    if (val === undefined || val === "" || val === null) return undefined;
    const trimmed = typeof val === "string" ? val.trim() : val;
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      return NaN;
    }
    return n;
  },
  z.number().refine((n) => !Number.isNaN(n), { message: "Invalid min_price" }).optional(),
);

const coerceMaxPrice = z.preprocess(
  (val) => {
    if (val === undefined || val === "" || val === null) return undefined;
    const trimmed = typeof val === "string" ? val.trim() : val;
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      return NaN;
    }
    return n;
  },
  z.number().refine((n) => !Number.isNaN(n), { message: "Invalid max_price" }).optional(),
);

const coerceMinRating = z.preprocess(
  (val) => {
    if (val === undefined || val === "" || val === null) return undefined;
    const trimmed = typeof val === "string" ? val.trim() : val;
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    if (Number.isNaN(n)) {
      return NaN;
    }
    return n;
  },
  z.number().refine((n) => !Number.isNaN(n), { message: "Invalid min_rating" }).optional(),
);

export const ListProductsQuerySchema = z.object({
  q: z.string().optional().default(""),
  sort: z.enum(["similarity", "price_asc", "price_desc", "rating"]).optional().default("similarity"),
  page: coercePage,
  min_price: coerceMinPrice,
  max_price: coerceMaxPrice,
  min_rating: coerceMinRating,
});

export const AddToCartBodySchema = z.object({
  product_id: z.string().min(1),
});

export const UpdateCartBodySchema = z.object({
  product_id: z.string(),
  quantity: z.number().int().min(0).optional().default(1),
});

export const UpdateUserBodySchema = z.object({
  field: z.enum(["username", "gender", "email", "phone", "address"]),
  value: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const ListProductsResponseSchema = z.object({
  products: z.array(ProductSchema),
  total_products: z.number(),
  total_pages: z.number(),
  current_page: z.number(),
  products_per_page: z.number(),
});

export const CartResponseSchema = z.object({
  items: z.array(CartItemSchema),
  total: z.number(),
  count: z.number(),
});

export const CartMutationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  cart_count: z.number().optional(),
});

export const CheckoutResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  order_id: z.string().optional(),
});

export const ListOrdersResponseSchema = z.object({
  orders: z.array(OrderSchema),
  total: z.number(),
});

export const GenericSuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

