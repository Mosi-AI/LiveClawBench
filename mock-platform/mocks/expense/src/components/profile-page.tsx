/** @jsxImportSource hono/jsx */
import { Layout } from "./layout.js";
import type { FC } from "hono/jsx";
import type { User } from "../types.js";

interface ProfilePageProps {
  user: User;
}

export const ProfilePage: FC<ProfilePageProps> = ({ user }) => {
  const initial = user.full_name.charAt(0).toUpperCase();

  return (
    <Layout title="Profile">
      <div class="profile-card">
        <div class="profile-avatar">
          {user.avatar_url ? <img src={user.avatar_url} alt={user.full_name} /> : <span class="avatar-letter">{initial}</span>}
        </div>
        <div class="profile-info">
          <h2>{user.full_name}</h2>
          <div class="profile-field"><label>Email</label><span>{user.email}</span></div>
          <div class="profile-field"><label>Department</label><span>{user.department}</span></div>
          <div class="profile-field"><label>Role</label><span>{user.role}</span></div>
          <div class="profile-field"><label>Preferred Currency</label><span>{user.preferred_currency}</span></div>
        </div>
        <a href="/dashboard" class="btn btn-outline">Back</a>
      </div>
    </Layout>
  );
};
