/** @jsxImportSource hono/jsx */
import { html, raw } from "hono/html";
import type { FC } from "hono/jsx";

interface LoginPageProps {
  error?: string;
}

export const LoginPage: FC<LoginPageProps> = ({ error }) => {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mosi Expenses - Sign In</title>
<link rel="stylesheet" href="/static/css/style.css">
</head>
<body class="login-body">
<div class="login-card">
  <div class="login-brand">
    <h1>Mosi Expenses</h1>
  </div>
  ${error ? html`<div class="login-error">${error}</div>` : ""}
  <form method="post" action="/login" class="login-form">
    <div class="form-group">
      <label for="email">Work email</label>
      <input type="email" id="email" name="email" required autocomplete="email" placeholder="you@company.com">
    </div>
    <div class="form-group">
      <label for="password">Password</label>
      <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="Enter password">
    </div>
    <button type="submit" class="btn btn-primary btn-full">Sign in</button>
  </form>
  <div class="test-accounts">
    <p class="test-accounts-label">Quick test accounts:</p>
    <button type="button" class="btn btn-outline test-account-btn" onclick="document.getElementById('email').value='alice@mosi.inc';document.getElementById('password').value='password123'">Alice (Operations)</button>
    <button type="button" class="btn btn-outline test-account-btn" onclick="document.getElementById('email').value='bob@mosi.inc';document.getElementById('password').value='password123'">Bob (Finance)</button>
  </div>
</div>
</body>
</html>`;
};
