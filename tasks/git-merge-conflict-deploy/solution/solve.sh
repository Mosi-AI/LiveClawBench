#!/usr/bin/env bash
set -euo pipefail
echo "Reference solution for git-merge-conflict-deploy"
echo "================================================="

cd /workspace/webapp
git checkout main

# Attempt merge — will conflict
git merge feature/payment --no-edit || true

# Resolve cart.js — combine coupon + payment method
cat > src/cart.js << 'EOF'
/**
 * Shopping cart module.
 */

class Cart {
  constructor() {
    this.items = [];
    this.couponCode = null;
    this.couponDiscount = 0;
    this.paymentMethod = null;
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

  setPaymentMethod(method) {
    this.paymentMethod = method;
  }

  clear() {
    this.items = [];
    this.couponCode = null;
    this.couponDiscount = 0;
    this.paymentMethod = null;
  }
}

module.exports = { Cart };
EOF

# Resolve utils.js — keep multi-currency + add calculateTax
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

function calculateTax(amount, rate) {
  return Math.round(amount * rate * 100) / 100;
}

function generateOrderId() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = { formatPrice, calculateTax, generateOrderId };
EOF

# Resolve config.js — API v2 + payment gateway
cat > src/config.js << 'EOF'
/**
 * Application configuration.
 */

const config = {
  APP_NAME: "WebApp",
  API_BASE_URL: "/api/v2",
  MAX_CART_ITEMS: 50,
  CURRENCY: "USD",
  PAYMENT_GATEWAY_URL: "https://pay.example.com/v1",
};

module.exports = config;
EOF

# Stage and commit
git add -A
git commit -m "Merge feature/payment into main: combine coupon, payment, multi-currency"

# Run tests to verify
npm test

echo "Reference solution complete."
