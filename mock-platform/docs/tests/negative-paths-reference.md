# Negative-Paths Reference

Layer 2 test specification — not executable; formalize into bun:test in a future PR

These 16 test cases validate fail-fast behavior, input validation, and write-failure handling in the shop and doc-search mocks.

---

## Startup Failure (Tests 1–3)

Verify that corrupted or missing seed data causes immediate non-zero exit.

| # | Target | Condition | Command | Expected Result |
|---|--------|-----------|---------|-----------------|
| 1 | Shop | Corrupted `products.json` (`"NOT JSON"`) | `MOCK_PRODUCTS_PATH="$TMPDIR/corrupt/static/shop/products.json" MOCK_DATA_DIR="$TMPDIR/corrupt/data" bun run mocks/shop/src/index.tsx --port 19001` | Process exits non-zero within 2 s |
| 2 | Shop | Missing `products.json` | `MOCK_PRODUCTS_PATH="$TMPDIR/missing/static/shop/products.json" MOCK_DATA_DIR="$TMPDIR/missing/data" bun run mocks/shop/src/index.tsx --port 19002` | Process exits non-zero within 2 s |
| 3 | Doc-search | Missing SQL seed (`documents.sql`) | `BROWSER_MOCK_DATA_DIR="$TMPDIR/docsearch-missing" HOME="$TMPDIR/docsearch-missing" bun run mocks/doc-search/src/index.ts --port 19003` | Process exits non-zero within 2 s |

---

## HTTP Validation (Tests 4–11)

Run against a live shop instance with a valid `products.json` on port 19999.

| # | Endpoint | Condition | Command | Expected Result |
|---|----------|-----------|---------|-----------------|
| 4 | `POST /api/cart/add` | Malformed JSON body (`"not json"`) | `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:19999/api/cart/add -H "Content-Type: application/json" -d "not json"` | `400` |
| 5 | `PUT /api/cart/update` | Malformed JSON body (`"{bad"`) | `curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:19999/api/cart/update -H "Content-Type: application/json" -d "{bad"` | `400` |
| 6 | `POST /api/user/update` | Malformed JSON body (`"xyz"`) | `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:19999/api/user/update -H "Content-Type: application/json" -d "xyz"` | `400` |
| 7 | `GET /search` | Invalid `min_price` (`"abc"`) | `curl -s -o /dev/null -w "%{http_code}" "http://localhost:19999/search?min_price=abc"` | `400` |
| 8 | `GET /api/products` | Invalid `max_price` (`"xyz"`) | `curl -s -o /dev/null -w "%{http_code}" "http://localhost:19999/api/products?max_price=xyz"` | `400` |
| 9 | `POST /api/cart/add` | Missing `product_id` (`{}`) | `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:19999/api/cart/add -H "Content-Type: application/json" -d '{}' ` | `400` |
| 10 | `PUT /api/cart/update` | Missing `product_id` (`{"quantity": 1}`) | `curl -s -o /dev/null -w "%{http_code}" -X PUT http://localhost:19999/api/cart/update -H "Content-Type: application/json" -d '{"quantity": 1}' ` | `400` |
| 11 | `POST /api/cart/add` | Non-existent `product_id` (`"nonexistent_xyz"`) | `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:19999/api/cart/add -H "Content-Type: application/json" -d '{"product_id": "nonexistent_xyz"}' ` | `404` |

---

## Write Failure (Tests 12–16)

Run against a live shop instance after seeding writable state (cart, user, orders) on port 19998. Tests simulate disk-full / permission-denied by `chmod 444` on JSON files before the request.

| # | Endpoint | Locked File | Command | Expected Result |
|---|----------|-------------|---------|-----------------|
| 12 | `DELETE /api/cart/remove/:id` | `mosi_shop_cart.json` | `curl -s -w '\nHTTP_CODE:%{http_code}' -X DELETE http://localhost:19998/api/cart/remove/p1 -H "Content-Type: application/json"` | `500` + body contains `"error"` and `"Failed to save cart"` |
| 13 | `POST /api/user/update` | `mosi_shop_user.json` | `curl -s -w '\nHTTP_CODE:%{http_code}' -X POST http://localhost:19998/api/user/update -H "Content-Type: application/json" -d '{"field": "address", "value": "123 Main St"}'` | `500` + body contains `"error"` and `"Failed to save user profile"` |
| 14a | `POST /api/checkout` | `mosi_shop_orders.json` | `curl -s -w '\nHTTP_CODE:%{http_code}' -X POST http://localhost:19998/api/checkout -H "Content-Type: application/json" -d '{}'` | `500` + body contains `"error"` and `"Failed to save order"` |
| 14b | `POST /api/checkout` | `mosi_shop_cart.json` (orders writable) | `curl -s -w '\nHTTP_CODE:%{http_code}' -X POST http://localhost:19998/api/checkout -H "Content-Type: application/json" -d '{}'` | `500` + body contains `"error"` and `"Order saved but cart clear failed"` |
| 15 | `POST /api/cart/clear` | `mosi_shop_cart.json` | `curl -s -w '\nHTTP_CODE:%{http_code}' -X POST http://localhost:19998/api/cart/clear -H "Content-Type: application/json"` | `500` + body contains `"error"` and `"Failed to clear cart"` |

> **Note:** Test 14b validates the two-phase commit behavior of checkout: order persistence succeeds, but the subsequent cart-clear fails.

---

## Portability Caveats

This specification is **not a portable, CI-quality test suite**. The following limitations apply:

- **Fixed ports** (`19001`, `19002`, `19003`, `19998`, `19999`) can collide with other processes already listening on those ports.
- **Host networking** — all `curl` commands target `localhost`, so tests run on the host and are not isolated inside containers.
- **Write-failure simulation** uses `chmod 444`, which is Unix-specific and may not work on all filesystems (e.g., Windows NTFS, some network mounts).

---

## Summary

| Category | Count |
|----------|-------|
| Startup failure | 3 |
| HTTP validation | 8 |
| Write failure | 5 |
| **Total** | **16** |
