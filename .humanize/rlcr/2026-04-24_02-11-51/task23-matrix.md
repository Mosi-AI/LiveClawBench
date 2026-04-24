# Task 23: Shop Query/Body Parameter Backward-Compatibility Matrix

## Overview

This document compares pre-migration (manual validation) vs post-migration (Zod schema) behavior for all shop query and body parameters. The pre-migration behavior is derived from the HTML page handler in `mocks/shop/src/index.tsx` lines 931-972 (the `/search` page route), which uses manual `parseInt`/`parseFloat` with NaN checks. The post-migration behavior is derived from the Zod schemas in `mocks/shop/src/schemas.ts` and verified by tests in `mocks/shop/src/schemas.test.ts` and `mocks/shop/src/index.test.ts`.

---

## Query Parameters

### `page`

Schema: `coercePage` — `z.preprocess()` with silent fallback to 1

| Boundary | Input | Pre-Migration Behavior | Post-Migration Behavior | Match? |
|----------|-------|------------------------|-------------------------|--------|
| Valid integer | `"3"` | `page = 3` | `page = 3` | Yes |
| Valid integer string | `"1"` | `page = 1` | `page = 1` | Yes |
| Empty string | `""` | `parseInt("", 10) = NaN` → `Math.max(1, NaN \|\| 1)` = `1` | Preprocess returns `1` | Yes |
| Non-numeric string | `"abc"` | `parseInt("abc", 10) = NaN` → `Math.max(1, NaN \|\| 1)` = `1` | Preprocess returns `1` | Yes |
| Negative number | `"-1"` | `parseInt("-1", 10) = -1` → `Math.max(1, -1)` = `1` | Preprocess returns `1` (n < 1 check) | Yes |
| Float | `"3.7"` | `parseInt("3.7", 10) = 3` | `Math.floor(3.7)` = `3` | Yes |
| Missing/undefined | (not provided) | `parseInt(undefined, 10) = NaN` → `Math.max(1, NaN \|\| 1)` = `1` | Preprocess returns `1` (undefined check) | Yes |
| Zero | `"0"` | `parseInt("0", 10) = 0` → `Math.max(1, 0)` = `1` | Preprocess returns `1` (n < 1 check) | Yes |

**Analysis:** Full behavioral match. Both implementations silently coerce invalid/missing page values to 1. The Zod schema uses `z.preprocess()` to replicate the exact same fallback logic.

---

### `min_price`

Schema: `coerceMinPrice` — `z.preprocess()` with strict NaN validation

| Boundary | Input | Pre-Migration Behavior | Post-Migration Behavior | Match? |
|----------|-------|------------------------|-------------------------|--------|
| Valid numeric string | `"100"` | `parseFloat("100") = 100` → used as filter | `Number("100") = 100` → valid | Yes |
| Empty string | `""` | `c.req.query("min_price")` returns `""` → `parseFloat("") = NaN` → `Number.isNaN(NaN)` = true → `undefined` (line 935-936: only sets if truthy) | Preprocess returns `undefined` → omitted from result | Yes |
| Non-numeric string | `"abc"` | `parseFloat("abc") = NaN` → NaN check on line 939 triggers 400 `{ error: "Invalid numeric filter parameter" }` | Preprocess returns `NaN` → `z.refine()` fails → throws ZodError → `defaultHook` returns 400 `{ error: "min_price: Invalid min_price" }` | Yes (both 400) |
| Negative number | `"-50"` | `parseFloat("-50") = -50` → used as filter | `Number("-50") = -50` → valid (no min constraint) | Yes |
| Float | `"99.99"` | `parseFloat("99.99") = 99.99` → used as filter | `Number("99.99") = 99.99` → valid | Yes |
| Missing/undefined | (not provided) | Query param absent → `undefined` (not set) | Preprocess returns `undefined` → omitted | Yes |

**Analysis:** Full behavioral match. The pre-migration code manually checked for NaN and returned 400. The Zod schema uses `z.preprocess()` + `z.refine()` to achieve the same strict validation. The error message format differs slightly (`"Invalid numeric filter parameter"` vs `"min_price: Invalid min_price"`), but the HTTP status and semantic behavior match.

---

### `max_price`

Schema: `coerceMaxPrice` — identical structure to `min_price`

| Boundary | Input | Pre-Migration Behavior | Post-Migration Behavior | Match? |
|----------|-------|------------------------|-------------------------|--------|
| Valid numeric string | `"500"` | `parseFloat("500") = 500` → used as filter | `Number("500") = 500` → valid | Yes |
| Empty string | `""` | `parseFloat("") = NaN` → not set (truthy check) | Preprocess returns `undefined` | Yes |
| Non-numeric string | `"abc"` | `parseFloat("abc") = NaN` → 400 error | `z.refine()` fails → 400 error | Yes |
| Negative number | `"-10"` | `parseFloat("-10") = -10` → used as filter | `Number("-10") = -10` → valid | Yes |
| Float | `"199.99"` | `parseFloat("199.99") = 199.99` → used as filter | `Number("199.99") = 199.99` → valid | Yes |
| Missing/undefined | (not provided) | Absent → `undefined` | Preprocess returns `undefined` | Yes |

**Analysis:** Identical to `min_price`. Full behavioral match.

---

### `min_rating`

Schema: `coerceMinRating` — identical structure to `min_price`/`max_price`

| Boundary | Input | Pre-Migration Behavior | Post-Migration Behavior | Match? |
|----------|-------|------------------------|-------------------------|--------|
| Valid numeric string | `"4.5"` | `parseFloat("4.5") = 4.5` → used as filter | `Number("4.5") = 4.5` → valid | Yes |
| Empty string | `""` | `parseFloat("") = NaN` → not set | Preprocess returns `undefined` | Yes |
| Non-numeric string | `"abc"` | `parseFloat("abc") = NaN` → 400 error | `z.refine()` fails → 400 error | Yes |
| Negative number | `"-1"` | `parseFloat("-1") = -1` → used as filter | `Number("-1") = -1` → valid | Yes |
| Float | `"3.7"` | `parseFloat("3.7") = 3.7` → used as filter | `Number("3.7") = 3.7` → valid | Yes |
| Missing/undefined | (not provided) | Absent → `undefined` | Preprocess returns `undefined` | Yes |

**Analysis:** Identical to `min_price`. Full behavioral match.

---

### `q` (search query)

Schema: `z.string().optional().default("")`

| Boundary | Input | Pre-Migration Behavior | Post-Migration Behavior | Match? |
|----------|-------|------------------------|-------------------------|--------|
| Valid string | `"watch"` | `c.req.query("q")` = `"watch"` | `"watch"` | Yes |
| Empty string | `""` | `c.req.query("q")` = `""` | `""` (default not applied because empty string is a valid string) | Yes |
| Missing/undefined | (not provided) | `c.req.query("q") ?? ""` = `""` | `z.string().optional().default("")` = `""` | Yes |
| Special characters | `"watch & band"` | Passed through as-is | Passed through as-is | Yes |

**Analysis:** Full behavioral match. The `?? ""` fallback in pre-migration exactly matches the `.default("")` in Zod.

---

### `sort`

Schema: `z.enum(["similarity", "price_asc", "price_desc", "rating"]).optional().default("similarity")`

| Boundary | Input | Pre-Migration Behavior | Post-Migration Behavior | Match? |
|----------|-------|------------------------|-------------------------|--------|
| Valid enum | `"price_asc"` | `"price_asc"` | `"price_asc"` | Yes |
| Default value | `"similarity"` | `"similarity"` | `"similarity"` | Yes |
| Invalid enum | `"invalid"` | Passed through to `filterAndSortProducts` which may ignore it or use default | **Throws ZodError** → 400 `{ error: "sort: Invalid enum value..." }` | **No** |
| Empty string | `""` | `c.req.query("sort")` = `""` → passed through | `.default("similarity")` not applied (empty string is a valid string input, but enum validation fails) → **throws** | **No** |
| Missing/undefined | (not provided) | `c.req.query("sort") ?? "similarity"` = `"similarity"` | `.default("similarity")` = `"similarity"` | Yes |

**Analysis:** **Behavioral divergence detected.**

1. **Invalid enum value:** Pre-migration allowed any string through; the search algorithm would treat unknown sort values as "similarity" (defensive fallback). Post-migration rejects invalid enum values with 400.

2. **Empty string:** Pre-migration passed `""` through to the search algorithm. Post-migration treats `""` as an invalid enum value and returns 400.

**Impact assessment:** The stricter validation is arguably an improvement — silently ignoring invalid sort parameters could lead to confusing UX. However, this is a **breaking change** for any client that was sending invalid sort values and expecting them to be silently ignored.

**Mitigation:** If backward compatibility is required, change the schema to:
```ts
sort: z.enum(["similarity", "price_asc", "price_desc", "rating"])
  .optional()
  .default("similarity")
  .or(z.literal("").transform(() => "similarity"))
```

---

## Body Parameters

### `product_id` (POST /api/cart/add)

Schema: `z.string().min(1)`

| Boundary | Input | Pre-Migration Behavior | Post-Migration Behavior | Match? |
|----------|-------|------------------------|-------------------------|--------|
| Valid ID | `"prod_0001"` | Accepted, product looked up | Accepted, product looked up | Yes |
| Empty string | `""` | Looked up in product list, not found → 404 | **Throws ZodError** → 400 `{ error: "product_id: String must contain at least 1 character(s)" }` | **No** |
| Missing/undefined | `{}` | `product_id` is `undefined` → lookup fails → 404 | **Throws ZodError** → 400 `{ error: "product_id: Required" }` | **No** |
| Non-string | `123` | `allProducts.find(p => p.id === 123)` → not found → 404 | **Throws ZodError** → 400 (type mismatch) | **No** |

**Analysis:** **Behavioral divergence detected.**

Pre-migration did not validate `product_id` at the boundary. Any value (including empty string, missing, or non-string) would be passed to the product lookup, resulting in a 404. Post-migration validates at the boundary and returns 400 for malformed input.

**Impact:** This is a **semantic improvement** — 400 is the correct status for malformed input, while 404 should be reserved for "well-formed ID that doesn't exist." The test suite (`index.test.ts` line 182-191) verifies that missing body returns 400, confirming this is the intended behavior.

---

### `product_id` (PUT /api/cart/update)

Schema: `z.string()` (in `UpdateCartBodySchema`)

| Boundary | Input | Pre-Migration Behavior | Post-Migration Behavior | Match? |
|----------|-------|------------------------|-------------------------|--------|
| Valid ID | `"prod_0001"` | Accepted, cart updated | Accepted, cart updated | Yes |
| Empty string | `""` | Lookup in cart fails → 404 | Accepted (no `.min(1)` on this schema) → lookup fails → 404 | Yes |
| Missing/undefined | `{ quantity: 2 }` | `product_id` is `undefined` → lookup fails → 404 | **Throws ZodError** → 400 `{ error: "product_id: Required" }` | **No** |

**Analysis:** **Minor divergence.** The `UpdateCartBodySchema` uses `z.string()` without `.min(1)`, so empty string behavior matches pre-migration. Missing `product_id` now returns 400 instead of 404.

---

### `quantity` (PUT /api/cart/update)

Schema: `z.number().int().min(0)` (in `UpdateCartBodySchema`)

| Boundary | Input | Pre-Migration Behavior | Post-Migration Behavior | Match? |
|----------|-------|------------------------|-------------------------|--------|
| Valid integer | `3` | `quantity = 3` → item updated | `quantity = 3` → valid | Yes |
| Zero | `0` | `quantity <= 0` → item removed | `quantity = 0` → valid (min(0) allows 0) → item removed | Yes |
| Negative | `-1` | `quantity <= 0` → item removed | **Throws ZodError** → 400 `{ error: "quantity: Number must be greater than or equal to 0" }` | **No** |
| Float | `2.5` | `quantity = 2.5` → item quantity set to 2.5 (stored as float) | **Throws ZodError** → 400 `{ error: "quantity: Expected integer, received float" }` | **No** |
| Missing/undefined | `{ product_id: "p" }` | `quantity` is `undefined` → `undefined <= 0` is `false` → quantity set to `undefined` (NaN in arithmetic) | **Throws ZodError** → 400 `{ error: "quantity: Required" }` | **No** |
| String | `"3"` | `"3"` compared with `<= 0` → `"3" <= 0` is `false` → quantity set to `"3"` (string in number field) | **Throws ZodError** → 400 (type mismatch) | **No** |

**Analysis:** **Significant behavioral divergence.**

Pre-migration had no validation on `quantity`. The route handler used loose JavaScript comparison (`quantity <= 0`) which coerced strings and handled missing values in unexpected ways. Post-migration enforces strict type safety:
- Must be a number (not string)
- Must be an integer
- Must be >= 0

The test suite (`index.test.ts` line 320-329) explicitly tests negative quantity → 400, confirming this is intended behavior. The `schemas.test.ts` line 132-134 also verifies negative quantity throws.

**Impact:** This is a **major improvement** in data integrity. Pre-migration could store strings or floats in the `quantity` field, leading to subtle bugs in cart total calculations.

---

### `field` (POST /api/user/update)

Schema: `z.enum(["username", "gender", "email", "phone", "address"])`

| Boundary | Input | Pre-Migration Behavior | Post-Migration Behavior | Match? |
|----------|-------|------------------------|-------------------------|--------|
| Valid enum | `"email"` | Accepted, field updated | Accepted, field updated | Yes |
| Invalid enum | `"password"` | `(user as Record<string, unknown>)["password"] = value` → **new field created** | **Throws ZodError** → 400 `{ error: "field: Invalid enum value..." }` | **No** |
| Empty string | `""` | `(user as Record<string, unknown>)[""] = value` → **empty key created** | **Throws ZodError** → 400 (invalid enum) | **No** |
| Missing/undefined | `{ value: "x" }` | `field` is `undefined` → `(user)[undefined] = value` | **Throws ZodError** → 400 `{ error: "field: Required" }` | **No** |

**Analysis:** **Critical behavioral divergence.**

Pre-migration had **no field validation whatsoever**. Any string could be used as a dynamic property key, allowing arbitrary field creation or even prototype pollution risks (though `Object.prototype` properties are not directly assignable this way). Post-migration restricts updates to the 5 known fields.

**Impact:** This is a **security fix**. The pre-migration behavior was a data integrity vulnerability. The test suite (`index.test.ts` line 427-436) verifies invalid field → 400.

---

### `value` (POST /api/user/update)

Schema: `z.string().min(1)`

| Boundary | Input | Pre-Migration Behavior | Post-Migration Behavior | Match? |
|----------|-------|------------------------|-------------------------|--------|
| Valid string | `"new@email.com"` | Accepted, value updated | Accepted, value updated | Yes |
| Empty string | `""` | `(user)[field] = ""` → field cleared to empty string | **Throws ZodError** → 400 `{ error: "value: String must contain at least 1 character(s)" }` | **No** |
| Missing/undefined | `{ field: "email" }` | `value` is `undefined` → field set to `undefined` | **Throws ZodError** → 400 `{ error: "value: Required" }` | **No** |
| Non-string | `123` | `(user)[field] = 123` → field set to number | **Throws ZodError** → 400 (type mismatch) | **No** |

**Analysis:** **Behavioral divergence.**

Pre-migration allowed empty strings, `undefined`, and non-string values. Post-migration requires a non-empty string. The frontend JavaScript (`PROFILE_JS` in `index.tsx` line 631) already had a client-side guard (`if (!newValue) { alert('Value cannot be empty'); return; }`), so this change aligns server-side validation with client-side expectations.

---

## Summary Matrix

| Parameter | Pre-Migration Validation | Post-Migration Validation | Divergences | Risk Level |
|-----------|-------------------------|---------------------------|-------------|------------|
| `page` | Manual `parseInt` + `Math.max` | `z.preprocess()` silent fallback | None | None |
| `min_price` | Manual `parseFloat` + NaN check | `z.preprocess()` + `z.refine()` | None (error msg format only) | None |
| `max_price` | Manual `parseFloat` + NaN check | `z.preprocess()` + `z.refine()` | None | None |
| `min_rating` | Manual `parseFloat` + NaN check | `z.preprocess()` + `z.refine()` | None | None |
| `q` | `c.req.query()` with `?? ""` | `z.string().default("")` | None | None |
| `sort` | No validation | `z.enum()` | Invalid/empty values now 400 | Low |
| `product_id` (add) | No validation | `z.string().min(1)` | Empty/missing now 400 | Low |
| `product_id` (update) | No validation | `z.string()` | Missing now 400 | Low |
| `quantity` | No validation | `z.number().int().min(0)` | Negative/float/string now 400 | Medium (improvement) |
| `field` | No validation | `z.enum()` | Arbitrary field creation blocked | High (security fix) |
| `value` | No validation | `z.string().min(1)` | Empty/undefined now 400 | Low |

---

## Recommendations

1. **No action needed** for `page`, `min_price`, `max_price`, `min_rating`, `q` — full backward compatibility.

2. **Monitor `sort`** — if any task verifier or client sends invalid sort values, it will now receive 400 instead of silent fallback. The current test suite does not test invalid sort values.

3. **`quantity` validation is a net improvement** — prevents float/string quantities that could corrupt cart arithmetic. Keep as-is.

4. **`field` enum is a security fix** — prevents arbitrary property injection. Keep as-is.

5. **Consider adding `.min(1)` to `UpdateCartBodySchema.product_id`** for consistency with `AddToCartBodySchema`:
   ```ts
   export const UpdateCartBodySchema = z.object({
     product_id: z.string().min(1),  // add .min(1)
     quantity: z.number().int().min(0),
   });
   ```
