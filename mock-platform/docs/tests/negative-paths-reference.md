# Negative-Paths Reference

Extracted from `scripts/negative-path-checks.sh`. These 16 test cases validate fail-fast behavior, input validation, and write-failure handling in the shop and doc-search mocks.

> **Test Layer:** Layer 2 (integration / shell-based)  
> **Prerequisites:** `bun`, mock-platform dependencies installed  
> **Execution:** `bash scripts/negative-path-checks.sh`

---

## Startup Failure (Tests 1–3)

Verify that corrupted or missing seed data causes immediate non-zero exit.

| # | Target | Condition | Expected Result |
|---|--------|-----------|-----------------|
| 1 | Shop | Corrupted `products.json` (`"NOT JSON"`) | Process exits non-zero within 2s |
| 2 | Shop | Missing `products.json` | Process exits non-zero within 2s |
| 3 | Doc-search | Missing SQL seed (`documents.sql`) | Process exits non-zero within 2s |

---

## HTTP Validation (Tests 4–11)

Run against a live shop instance with a valid `products.json`.

| # | Endpoint | Condition | Expected Result |
|---|----------|-----------|-----------------|
| 4 | `POST /api/cart/add` | Malformed JSON body (`"not json"`) | `400 Bad Request` |
| 5 | `PUT /api/cart/update` | Malformed JSON body (`"{bad"`) | `400 Bad Request` |
| 6 | `POST /api/user/update` | Malformed JSON body (`"xyz"`) | `400 Bad Request` |
| 7 | `GET /search` | Invalid `min_price` (`"abc"`) | `400 Bad Request` |
| 8 | `GET /api/products` | Invalid `max_price` (`"xyz"`) | `400 Bad Request` |
| 9 | `POST /api/cart/add` | Missing `product_id` (`{}`) | `400 Bad Request` |
| 10 | `PUT /api/cart/update` | Missing `product_id` (`{"quantity": 1}`) | `400 Bad Request` |
| 11 | `POST /api/cart/add` | Non-existent `product_id` (`"nonexistent_xyz"`) | `404 Not Found` |

---

## Write Failure (Tests 12–16)

Run against a live shop instance after seeding writable state (cart, user, orders). Tests simulate disk-full / permission-denied by `chmod 444` on JSON files before the request.

| # | Endpoint | Locked File | Expected Result |
|---|----------|-------------|-----------------|
| 12 | `DELETE /api/cart/remove/:id` | `mosi_shop_cart.json` | `500` + `{ "error": "Failed to save cart" }` |
| 13 | `POST /api/user/update` | `mosi_shop_user.json` | `500` + `{ "error": "Failed to save user profile" }` |
| 14a | `POST /api/checkout` | `mosi_shop_orders.json` | `500` + `{ "error": "Failed to save order" }` |
| 14b | `POST /api/checkout` | `mosi_shop_cart.json` (orders writable) | `500` + `{ "error": "Order saved but cart clear failed" }` |
| 15 | `POST /api/cart/clear` | `mosi_shop_cart.json` | `500` + `{ "error": "Failed to clear cart" }` |

> **Note:** Test 14b validates the two-phase commit behavior of checkout: order persistence succeeds, but the subsequent cart-clear fails.

---

## Summary

| Category | Count |
|----------|-------|
| Startup failure | 3 |
| HTTP validation | 8 |
| Write failure | 5 |
| **Total** | **16** |
