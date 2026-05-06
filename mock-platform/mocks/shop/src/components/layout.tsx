/** @jsxImportSource hono/jsx */
import { html, raw } from "hono/html";
import type { FC, Child } from "hono/jsx";

export const Layout: FC<{ title: string; children: Child; scripts?: string; styles?: string }> = ({ title, children, scripts, styles }) => {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<link rel="stylesheet" href="/static/css/style.css">
${styles ? html`<style>${raw(styles)}</style>` : ""}
</head>
<body>
<nav class="navbar">
<a href="/">Home</a>
<a href="/cart">Cart (<span id="cart-count">0</span>)</a>
<a href="/profile">Profile</a>
<a href="/orders">Orders</a>
</nav>
${children}
<script>
async function updateCartCount() {
  try {
    const response = await fetch('/api/cart');
    const data = await response.json();
    const el = document.getElementById('cart-count');
    if (el) el.textContent = data.count;
  } catch (error) {
    console.error('Error fetching cart count:', error);
  }
}
updateCartCount();
</script>
${scripts ? html`<script>${raw(scripts)}</script>` : ""}
</body>
</html>`;
};
