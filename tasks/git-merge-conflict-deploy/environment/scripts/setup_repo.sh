#!/usr/bin/env bash
set -e

git config --global user.email "agent@company.com"
git config --global user.name "Agent"
git config --global init.defaultBranch main

mkdir -p /workspace/webapp
cd /workspace/webapp
git init

# ---- Create initial commit (shared base) ----
mkdir -p src tests

cat > package.json << 'EOF'
{
  "name": "webapp",
  "version": "1.0.0",
  "scripts": {
    "test": "node tests/test.js"
  },
  "dependencies": {
    "lodash": "4.17.20",
    "express": "4.18.2"
  }
}
EOF

# .env.example is referenced by ops docs but intentionally hidden from git —
# a previous engineer added it to .gitignore "to avoid leaking placeholder keys".
cat > .gitignore << 'EOF'
.env
.env.example
EOF

cat > .env.example << 'EOF'
# Copy to .env and fill in. NOT tracked — see .gitignore (issue #412).
API_KEY=__FILL_ME__
PAYMENT_GATEWAY_TOKEN=__FILL_ME__
EOF

# Security notice authored before the branch split — specifies the *minimum*
# versions that must survive any dependency reconciliation. Both main and
# feature/payment later bump only ONE of the two packages; the correct merge
# must honor the union of both constraints.
cat > SECURITY.md << 'EOF'
# Security Constraints (binding)

These constraints were ratified on 2026-03-14 and MUST hold in any merge of
feature branches. Any package.json resolution that violates either line
below is considered a release blocker.

- `lodash` MUST be `>= 4.17.21` (CVE-2021-23337 command injection in
  `template`; upstream advisory mandates 4.17.21 minimum).
- `express` MUST be `>= 4.20.0` (CVE-2024-29041 open redirect; fixed in
  4.19.2 patch but 4.20.0 adds the hardened `res.redirect` default; ops team
  has standardized on 4.20.0 across the fleet).

Any automated merge tooling should refuse a resolution that downgrades
either dependency relative to these floors. See `tests/test.js` for the
runtime assertion that enforces this contract.
EOF

# Outdated README left by a previous engineer — references a non-existent script.
cat > README.md << 'EOF'
# WebApp

Static + API webapp.

## Deploying

Run `npm run deploy` from the repo root after merging to main.
(See ops/runbook.md — not yet restored from the 2025 wiki migration.)
EOF

cat > src/cart.js << 'EOF'
/**
 * Shopping cart module.
 */

class Cart {
  constructor() {
    this.items = [];
  }

  addItem(item, quantity, price) {
    this.items.push({ item, quantity, price });
  }

  getTotal() {
    return this.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  }

  getItemCount() {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  clear() {
    this.items = [];
  }
}

module.exports = { Cart };
EOF

cat > src/utils.js << 'EOF'
/**
 * Utility functions.
 */

function formatPrice(amount) {
  return `$${amount.toFixed(2)}`;
}

function generateOrderId() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = { formatPrice, generateOrderId };
EOF

cat > src/config.js << 'EOF'
/**
 * Application configuration.
 */

const config = {
  APP_NAME: "WebApp",
  API_BASE_URL: "/api/v1",
  MAX_CART_ITEMS: 50,
  CURRENCY: "USD",
};

module.exports = config;
EOF

cat > tests/test.js << 'TESTEOF'
const { Cart } = require("../src/cart");
const { formatPrice, generateOrderId } = require("../src/utils");
const config = require("../src/config");

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  PASS: ${msg}`); }
  else { failed++; console.log(`  FAIL: ${msg}`); }
}

// Dependency-floor assertions (see SECURITY.md). These run first because
// the entire service contract depends on the correct resolved versions.
// Both floors are the *minimum* — higher patch versions are also acceptable.
function cmpSemver(a, b) {
  const pa = a.split(".").map((x) => parseInt(x, 10));
  const pb = b.split(".").map((x) => parseInt(x, 10));
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

console.log("Dependency floor checks (SECURITY.md):");
try {
  const lodashV = require("lodash/package.json").version;
  assert(cmpSemver(lodashV, "4.17.21") >= 0,
    `lodash ${lodashV} satisfies >= 4.17.21`);
} catch (e) {
  failed++; console.log(`  FAIL: lodash not installed (${e.message})`);
}
try {
  const expressV = require("express/package.json").version;
  assert(cmpSemver(expressV, "4.20.0") >= 0,
    `express ${expressV} satisfies >= 4.20.0`);
} catch (e) {
  failed++; console.log(`  FAIL: express not installed (${e.message})`);
}


// Cart tests
console.log("Cart tests:");
const cart = new Cart();
cart.addItem("Widget", 2, 10.00);
cart.addItem("Gadget", 1, 25.00);
assert(cart.getTotal() === 45.00, "getTotal = 45.00");
assert(cart.getItemCount() === 3, "getItemCount = 3");

// Coupon test (after merge, main added this)
if (typeof cart.applyCoupon === "function") {
  cart.applyCoupon("SAVE10", 0.10);
  assert(cart.getTotal() === 40.50, "applyCoupon 10% off = 40.50");
} else {
  failed++;
  console.log("  FAIL: applyCoupon method missing");
}

// Payment method test (after merge, feature/payment added this)
if (typeof cart.setPaymentMethod === "function") {
  cart.setPaymentMethod("credit_card");
  assert(cart.paymentMethod === "credit_card", "setPaymentMethod works");
} else {
  failed++;
  console.log("  FAIL: setPaymentMethod method missing");
}

// Utils tests
console.log("\nUtils tests:");
assert(formatPrice(10.5) === "$10.50", "formatPrice basic");

// Multi-currency test (main added this)
if (formatPrice.length >= 2 || formatPrice(10, "EUR") !== undefined) {
  const eur = formatPrice(10.5, "EUR");
  assert(eur === "€10.50", "formatPrice EUR");
  const gbp = formatPrice(10.5, "GBP");
  assert(gbp === "£10.50", "formatPrice GBP");
} else {
  failed++;
  console.log("  FAIL: formatPrice multi-currency missing");
}

// Tax calculation test (feature/payment added this)
let calculateTax;
try {
  calculateTax = require("../src/utils").calculateTax;
} catch(e) {}
if (typeof calculateTax === "function") {
  assert(calculateTax(100, 0.08) === 8.00, "calculateTax 8%");
  assert(calculateTax(50, 0.10) === 5.00, "calculateTax 10%");
} else {
  failed++;
  console.log("  FAIL: calculateTax function missing");
}

// Config tests
console.log("\nConfig tests:");
assert(config.API_BASE_URL === "/api/v2", "API URL is v2");
assert(config.PAYMENT_GATEWAY_URL === "https://pay.example.com/v1", "PAYMENT_GATEWAY_URL set");

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
TESTEOF

git add -A
git commit -m "Initial project setup"

# ---- Create an abandoned feature/refactor branch (noise) ----
git checkout -b feature/refactor

cat > src/cart.js << 'EOF'
/**
 * Shopping cart module — refactored for ES2020 best practices.
 */

class Cart {
  #items;

  constructor() {
    this.#items = [];
  }

  addItem(item, quantity, price) {
    this.#items.push({ item, quantity, price });
  }

  getTotal() {
    return this.#items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  }

  getItemCount() {
    return this.#items.reduce((sum, i) => sum + i.quantity, 0);
  }

  clear() {
    this.#items = [];
  }
}

module.exports = { Cart };
EOF

cat >> .gitignore << 'EOF'
node_modules/
dist/
*.log
.DS_Store
EOF

git add -A
git commit -m "Refactor: use private class fields (WIP — DO NOT MERGE)"
git tag -a abandoned-refactor -m "Abandoned: private fields break test compatibility"

# Switch back to main
git checkout main
# Reset cart.js to base (the refactor was abandoned)

# ---- Create main branch changes (intra-function modifications) ----

# main: modify constructor, getTotal, add applyCoupon, modify clear
cat > src/cart.js << 'EOF'
/**
 * Shopping cart module.
 */

class Cart {
  constructor() {
    this.items = [];
    this.couponCode = null;
    this.couponDiscount = 0;
  }

  addItem(item, quantity, price) {
    this.items.push({ item, quantity, price });
  }

  getTotal() {
    const subtotal = this.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
    return subtotal * (1 - this.couponDiscount);
  }

  getItemCount() {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  applyCoupon(code, discount) {
    this.couponCode = code;
    this.couponDiscount = discount;
  }

  clear() {
    this.items = [];
    this.couponCode = null;
    this.couponDiscount = 0;
  }
}

module.exports = { Cart };
EOF

# main: rewrite formatPrice with currency support (modifies function signature AND body)
cat > src/utils.js << 'EOF'
/**
 * Utility functions.
 */

const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

function formatPrice(amount, currency = "USD") {
  const symbol = CURRENCY_SYMBOLS[currency] || "$";
  return `${symbol}${amount.toFixed(2)}`;
}

function generateOrderId() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = { formatPrice, generateOrderId };
EOF

# main: bump dependency versions (semantic drift — no conflict marker, but picking the wrong one breaks tests)
cat > package.json << 'EOF'
{
  "name": "webapp",
  "version": "1.1.0",
  "scripts": {
    "test": "node tests/test.js"
  },
  "dependencies": {
    "lodash": "4.17.21",
    "express": "4.19.2"
  }
}
EOF

# main: update API endpoint to v2
cat > src/config.js << 'EOF'
/**
 * Application configuration.
 */

const config = {
  APP_NAME: "WebApp",
  API_BASE_URL: "/api/v2",
  MAX_CART_ITEMS: 50,
  CURRENCY: "USD",
};

module.exports = config;
EOF

git add -A
git commit -m "Add coupon support, multi-currency formatPrice, update API to v2"

# ---- Create feature/payment branch from base commit (2 commits back) ----
git checkout -b feature/payment HEAD~1

# feature/payment: add paymentMethod to constructor AND modify getTotal for precision
cat > src/cart.js << 'EOF'
/**
 * Shopping cart module.
 */

class Cart {
  constructor() {
    this.items = [];
    this.paymentMethod = null;
  }

  addItem(item, quantity, price) {
    this.items.push({ item, quantity, price });
  }

  getTotal() {
    const total = this.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
    return parseFloat(total.toFixed(2));
  }

  getItemCount() {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  }

  setPaymentMethod(method) {
    this.paymentMethod = method;
  }

  clear() {
    this.items = [];
    this.paymentMethod = null;
  }
}

module.exports = { Cart };
EOF

# feature/payment: add calculateTax AND modify formatPrice body (add validation)
cat > src/utils.js << 'EOF'
/**
 * Utility functions.
 */

function formatPrice(amount) {
  if (typeof amount !== "number" || isNaN(amount)) {
    return "$0.00";
  }
  return `$${amount.toFixed(2)}`;
}

function calculateTax(amount, rate) {
  return Math.round(amount * rate * 100) / 100;
}

function generateOrderId() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = { formatPrice, calculateTax, generateOrderId };
EOF

# feature/payment: pin older lodash but newer express (semantic drift vs main)
cat > package.json << 'EOF'
{
  "name": "webapp",
  "version": "1.0.1",
  "scripts": {
    "test": "node tests/test.js"
  },
  "dependencies": {
    "lodash": "4.17.20",
    "express": "4.20.0"
  }
}
EOF

# feature/payment: add PAYMENT_GATEWAY_URL to config (keep API at v1)
cat > src/config.js << 'EOF'
/**
 * Application configuration.
 */

const config = {
  APP_NAME: "WebApp",
  API_BASE_URL: "/api/v1",
  MAX_CART_ITEMS: 50,
  CURRENCY: "USD",
  PAYMENT_GATEWAY_URL: "https://pay.example.com/v1",
};

module.exports = config;
EOF

git add -A
git commit -m "Add payment method, calculateTax, payment gateway config"

# ---- Create a stash on feature/payment as noise ----
echo "// TODO: add refund logic" >> src/cart.js
git stash save "WIP: refund feature exploration"

# Go back to main
git checkout main

# Create a stash on main too (noise)
echo "// TODO: internationalization" >> src/utils.js
git stash save "WIP: i18n exploration"
