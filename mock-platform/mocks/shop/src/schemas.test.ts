import { describe, expect, test } from "bun:test";
import {
  ListProductsQuerySchema,
  AddToCartBodySchema,
  UpdateCartBodySchema,
  UpdateUserBodySchema,
} from "./schemas";

describe("ListProductsQuerySchema — page (silent fallback)", () => {
  test('"abc" → 1', () => {
    const result = ListProductsQuerySchema.parse({ page: "abc" });
    expect(result.page).toBe(1);
  });

  test('"-1" → 1', () => {
    const result = ListProductsQuerySchema.parse({ page: "-1" });
    expect(result.page).toBe(1);
  });

  test('"" → 1', () => {
    const result = ListProductsQuerySchema.parse({ page: "" });
    expect(result.page).toBe(1);
  });

  test('"3.7" → 3', () => {
    const result = ListProductsQuerySchema.parse({ page: "3.7" });
    expect(result.page).toBe(3);
  });

  test("missing → 1", () => {
    const result = ListProductsQuerySchema.parse({});
    expect(result.page).toBe(1);
  });

  test('"Infinity" → 1', () => {
    const result = ListProductsQuerySchema.parse({ page: "Infinity" });
    expect(result.page).toBe(1);
  });

  test('"1e309" (overflow) → 1', () => {
    const result = ListProductsQuerySchema.parse({ page: "1e309" });
    expect(result.page).toBe(1);
  });
});

describe("ListProductsQuerySchema — min_price / max_price / min_rating (strict validation)", () => {
  test("numeric string → applied", () => {
    const result = ListProductsQuerySchema.parse({
      min_price: "100",
      max_price: "500",
      min_rating: "4.5",
    });
    expect(result.min_price).toBe(100);
    expect(result.max_price).toBe(500);
    expect(result.min_rating).toBe(4.5);
  });

  test("'abc' → 400 (throws)", () => {
    expect(() => ListProductsQuerySchema.parse({ min_price: "abc" })).toThrow();
    expect(() => ListProductsQuerySchema.parse({ max_price: "abc" })).toThrow();
    expect(() => ListProductsQuerySchema.parse({ min_rating: "abc" })).toThrow();
  });

  test("empty → undefined", () => {
    const result = ListProductsQuerySchema.parse({
      min_price: "",
      max_price: "",
      min_rating: "",
    });
    expect(result.min_price).toBeUndefined();
    expect(result.max_price).toBeUndefined();
    expect(result.min_rating).toBeUndefined();
  });

  test("missing → undefined", () => {
    const result = ListProductsQuerySchema.parse({});
    expect(result.min_price).toBeUndefined();
    expect(result.max_price).toBeUndefined();
    expect(result.min_rating).toBeUndefined();
  });

  test("whitespace-only → undefined (not zero)", () => {
    const result = ListProductsQuerySchema.parse({
      min_price: "  ",
      max_price: "  ",
      min_rating: "  ",
    });
    expect(result.min_price).toBeUndefined();
    expect(result.max_price).toBeUndefined();
    expect(result.min_rating).toBeUndefined();
  });
});

describe("ListProductsQuerySchema — q (string)", () => {
  test("arbitrary string → passed through", () => {
    const result = ListProductsQuerySchema.parse({ q: "hello world" });
    expect(result.q).toBe("hello world");
  });

  test("empty → empty string", () => {
    const result = ListProductsQuerySchema.parse({ q: "" });
    expect(result.q).toBe("");
  });

  test("missing → empty string", () => {
    const result = ListProductsQuerySchema.parse({});
    expect(result.q).toBe("");
  });
});

describe("ListProductsQuerySchema — sort (enum)", () => {
  test("valid enum value → accepted", () => {
    const result = ListProductsQuerySchema.parse({ sort: "price_asc" });
    expect(result.sort).toBe("price_asc");
  });

  test("invalid → 400 (throws)", () => {
    expect(() => ListProductsQuerySchema.parse({ sort: "invalid" })).toThrow();
  });

  test('missing → default "similarity"', () => {
    const result = ListProductsQuerySchema.parse({});
    expect(result.sort).toBe("similarity");
  });
});

describe("AddToCartBodySchema — product_id", () => {
  test("valid → accepted", () => {
    const result = AddToCartBodySchema.parse({ product_id: "p-123" });
    expect(result.product_id).toBe("p-123");
  });

  test("missing → 400 (throws)", () => {
    expect(() => AddToCartBodySchema.parse({})).toThrow();
  });

  test("empty → 400 (throws)", () => {
    expect(() => AddToCartBodySchema.parse({ product_id: "" })).toThrow();
  });
});

describe("UpdateCartBodySchema — product_id and quantity", () => {
  test("valid → accepted", () => {
    const result = UpdateCartBodySchema.parse({ product_id: "p-123", quantity: 3 });
    expect(result.product_id).toBe("p-123");
    expect(result.quantity).toBe(3);
  });

  test("missing quantity → defaults to 1", () => {
    const result = UpdateCartBodySchema.parse({ product_id: "p-123" });
    expect(result.product_id).toBe("p-123");
    expect(result.quantity).toBe(1);
  });

  test("negative quantity → 400 (throws)", () => {
    expect(() => UpdateCartBodySchema.parse({ product_id: "p-123", quantity: -1 })).toThrow();
  });

  test("missing product_id → 400 (throws)", () => {
    expect(() => UpdateCartBodySchema.parse({ quantity: 2 })).toThrow();
  });
});

describe("UpdateUserBodySchema — field and value", () => {
  test("valid enum field → accepted", () => {
    const result = UpdateUserBodySchema.parse({ field: "email", value: "a@b.com" });
    expect(result.field).toBe("email");
    expect(result.value).toBe("a@b.com");
  });

  test("invalid field → 400 (throws)", () => {
    expect(() => UpdateUserBodySchema.parse({ field: "password", value: "secret" })).toThrow();
  });

  test("empty value → 400 (throws)", () => {
    expect(() => UpdateUserBodySchema.parse({ field: "username", value: "" })).toThrow();
  });

  test("missing field → 400 (throws)", () => {
    expect(() => UpdateUserBodySchema.parse({ value: "x" })).toThrow();
  });

  test("missing value → 400 (throws)", () => {
    expect(() => UpdateUserBodySchema.parse({ field: "username" })).toThrow();
  });
});
