# Task 10a: Shop Jinja → Hono+TSX Mapping Reference

## Template Inventory

Shop app has 5 Jinja2 templates, all self-contained (no `{% extends %}` or `{% include %}`):

| Template | Route | Purpose |
|----------|-------|---------|
| `home.html` | GET `/` | Landing page with search bar and categories |
| `results.html` | GET `/search?q=` | Product listing with relevance scoring |
| `cart.html` | GET `/cart` | Shopping cart with quantity controls |
| `orders.html` | GET `/orders` | Order history with status tracking |
| `profile.html` | GET `/profile` | User profile with editable fields |

## Jinja → TypeScript Mapping

### Filters

| Jinja Filter | Usage | TypeScript Equivalent |
|-------------|-------|----------------------|
| `{{ var\|round(2) }}` | cart.html, orders.html | `var.toFixed(2)` |
| `{{ list\|sum(attribute='quantity') }}` | cart.html | `list.reduce((s, i) => s + i.quantity, 0)` |
| `{{ var\|default('0')\|float }}` | results.html | `parseFloat(var \|\| '0')` |
| `{{ "%.2f"\|format(x) }}` | results.html | `x.toFixed(2)` |

### Control Flow

| Jinja Construct | Usage | TypeScript Equivalent |
|----------------|-------|----------------------|
| `{% set x = a if b else c %}` | results.html (5 places) | `const x = b ? a : c` |
| `{% if x in ['a', 'b'] %}` | orders.html | `['a', 'b'].includes(x)` |
| `{% for item in list %}` | all templates | `list.map(item => ...)` |

### Rendering Approach

The shop mock uses **Hono TSX Function Components** (`FC` from `hono/jsx`) for all 5 pages.
The entry point is `mocks/shop/src/index.tsx` (compiled via `bun build --compile` with JSX support).

**Layout wrapper**: A shared `Layout` FC wraps every page with `<html>`, `<head>`, `<body>` scaffolding.
It accepts `scripts` and `styles` props for per-page inline CSS/JS, rendered via `raw()` from `hono/html`
to prevent `escapeHtml()` from encoding script/style content.

**Page components** (all in `index.tsx`):

| Component | Route | Key Features |
|-----------|-------|-------------|
| `HomePage` | GET `/` | Search bar, category grid, Unicode emoji icons |
| `ResultsPage` | GET `/search?q=` | Product cards with relevance scores, `addToCart()` |
| `CartPage` | GET `/cart` | Quantity controls, totals, checkout button |
| `ProfilePage` | GET `/profile` | Editable fields, payment history, Unicode emoji icons |
| `OrdersPage` | GET `/orders` | Status tracking, return/confirm action buttons |

Each component:
1. Receives typed data as props
2. Uses Hono's `html` tagged template for the outer HTML shell (DOCTYPE, head, body)
3. Embeds TSX markup inside the template for dynamic content sections
4. Includes inline CSS as string constants rendered via `${raw(styles)}`
5. Includes inline JS as string constants rendered via `${raw(scripts)}`
6. Uses Unicode emoji characters directly in JSX text (safe rendering without HTML injection)

## Search Algorithm Mapping

The Python `calculate_relevance_score()` in `app.py` was ported to TypeScript as `calculateRelevanceScore()` in `mocks/shop/src/index.tsx`:

| Scoring Factor | Python | TypeScript |
|---------------|--------|------------|
| Exact title match | 100 | 100 |
| Exact word + position | 20 + max(0, 10 - pos) | 20 + max(0, 10 - pos) |
| Coverage | 30 * (matched/total) | 30 * (matched/total) |
| Partial/substring | 10/match | 10/match |
| Word frequency | min(freq * 5, 20) | min(freq * 5, 20) |
| Rating boost | rating * 2 | rating * 2 |
| Best seller | +15 | +15 |
| Overall pick | +15 | +15 |
| Min threshold | 10.0 | 10.0 |

## Data Storage Mapping

| Python (Flask) | TypeScript (Bun+Hono) |
|----------------|----------------------|
| JSON files in `/tmp/` | `JsonStore` in `/var/lib/mock-data/shop/` |
| Direct file read/write | `store.read(key, default)` / `store.write(key, data)` |
| `mosi_shop_orders.json` | key=`mosi_shop_orders` → file=`mosi_shop_orders.json` |
| `mosi_shop_cart.json` | key=`mosi_shop_cart` → file=`mosi_shop_cart.json` |
| `mosi_shop_user.json` | key=`mosi_shop_user` → file=`mosi_shop_user.json` |

## Client-Side JavaScript

All templates include inline `<script>` blocks ported from the original templates:

| Function | Purpose | Used In |
|----------|---------|---------|
| `addToCart(id)` | Add product to cart via POST `/cart/add` | results.html |
| `updateCart(id, qty)` | Update cart item quantity via PUT `/cart/update` | cart.html |
| `removeFromCart(id)` | Remove item via POST `/cart/remove` | cart.html |
| `clearCartAction()` | Clear cart via POST `/cart/clear` | cart.html |
| `checkout()` | Checkout via POST `/checkout` | cart.html |
| `returnOrder(id)` | Request return via POST `/orders/{id}/return` | orders.html |
| `confirmOrder(id)` | Confirm delivery via POST `/orders/{id}/confirm` | orders.html |
| `editField(field)` | Show edit modal for profile field | profile.html |
| `closeEditModal()` | Close edit modal | profile.html |
| `saveField(field)` | Save edited field via PUT `/profile` | profile.html |
| `showPaymentDetail(idx)` | Show payment detail modal | profile.html |
| `closeModal()` | Close payment detail modal | profile.html |
