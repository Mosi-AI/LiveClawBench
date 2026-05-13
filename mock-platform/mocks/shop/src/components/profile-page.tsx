/** @jsxImportSource hono/jsx */
import type { FC, Child } from "hono/jsx";
import { Layout } from "./layout.js";
import { PROFILE_CSS } from "./profile-css.js";
import { PROFILE_JS } from "./profile-js.js";
import type { UserData } from "../types.js";

function escJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

function getPaymentIcon(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("gift")) return "\u{1F381}";
  return "\u{1F4B3}";
}

export const ProfilePage: FC<{ user: UserData }> = ({ user }) => {
  const payments = user.payment_methods ?? [];
  const editIcon = "✏️";
  const paymentItems: Child[] = payments.map((m) => {
    const icon = getPaymentIcon(m.type);
    const balanceArg = m.balance ? `, '${escJs(m.balance)}'` : "";
    return <div class="payment-item" onclick={`showPaymentDetail('${escJs(m.type)}', '${escJs(m.account)}'${balanceArg})`}>
      <div class="payment-icon">{icon}</div>
      <div class="payment-info">
        <div class="payment-type">{m.type}</div>
        <div class="payment-account">{m.account}</div>
      </div>
      <div class="payment-arrow">{"›"}</div>
    </div>;
  });

  return <Layout title={`${user.username}'s Profile`} styles={PROFILE_CSS} scripts={PROFILE_JS}>
    <div class="profile-container">
      <div class="profile-header">
        <div class="profile-avatar">{"\u{1F464}"}</div>
        <h1>{user.username}</h1>
        <div class="profile-subtitle">Welcome to your profile</div>
      </div>
      <div class="profile-content">
        <div class="profile-section">
          <h2>Basic Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <label>Username</label>
              <div class="info-value" id="username-display">
                <span class="value-text">{user.username}</span>
                <button class="edit-btn" onclick={`editField('username', '${escJs(user.username)}')`}>{editIcon}</button>
              </div>
            </div>
            <div class="info-item">
              <label>Gender</label>
              <div class="info-value" id="gender-display">
                <span class="value-text">{user.gender}</span>
                <button class="edit-btn" onclick={`editField('gender', '${escJs(user.gender)}')`}>{editIcon}</button>
              </div>
            </div>
            <div class="info-item">
              <label>Email</label>
              <div class="info-value" id="email-display">
                <span class="value-text">{user.email}</span>
                <button class="edit-btn" onclick={`editField('email', '${escJs(user.email)}')`}>{editIcon}</button>
              </div>
            </div>
            <div class="info-item">
              <label>Phone</label>
              <div class="info-value" id="phone-display">
                <span class="value-text">{user.phone}</span>
                <button class="edit-btn" onclick={`editField('phone', '${escJs(user.phone)}')`}>{editIcon}</button>
              </div>
            </div>
            <div class="info-item full-width">
              <label>Delivery Address</label>
              <div class="info-value" id="address-display">
                <span class="value-text">{user.address}</span>
                <button class="edit-btn" onclick={`editField('address', '${escJs(user.address)}')`}>{editIcon}</button>
              </div>
            </div>
          </div>
        </div>
        {payments.length > 0
          ? <div class="profile-section">
              <h2>Payment Methods</h2>
              <div class="payment-methods">{paymentItems}</div>
            </div>
          : null}
        <div class="profile-actions">
          <a href="/orders" class="action-btn primary"><span class="action-icon">{"\u{1F4E6}"}</span><span>View My Orders</span></a>
          <a href="/cart" class="action-btn"><span class="action-icon">{"\u{1F6D2}"}</span><span>View Shopping Cart</span></a>
          <a href="/" class="action-btn"><span class="action-icon">{"\u{1F3E0}"}</span><span>Back to Home</span></a>
        </div>
      </div>
    </div>
  </Layout>;
};
