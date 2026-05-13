/** @jsxImportSource hono/jsx */
/**
 * Social mock — HTML page components
 * All TSX pages plus shared Layout and CSS.
 */

import { Hono } from "hono";
import { html, raw } from "hono/html";
import type { FC, Child } from "hono/jsx";
import type { Database } from "bun:sqlite";
import { getAccountByUsername, getAccountById, getPostById, getPostTags, getPostAssets, getPostMetrics, buildVisibilityAwareCommentTree } from "./db-queries";

// ---------------------------------------------------------------------------
// Types (duplicated from index.tsx to avoid circular import)
// ---------------------------------------------------------------------------

interface Account {
  id: number;
  username: string;
  password: string;
  display_name: string;
  account_type: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  website_url: string | null;
  location: string | null;
  timezone: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

interface Post {
  id: number;
  author_account_id: number;
  content: string;
  status: string;
  visibility: string;
  moderation_state: string;
  scheduled_for: string | null;
  scheduled_timezone: string | null;
  published_at: string | null;
  deleted_at: string | null;
  is_pinned: number;
  has_event_cta: number;
  created_at: string;
  updated_at: string;
}

interface PostAsset {
  id: number;
  post_id: number;
  asset_type: string;
  asset_url: string;
  preview_text: string | null;
  alt_text: string | null;
  sort_order: number;
}

interface Tag {
  id: number;
  label_text: string;
  normalized_name: string;
}

interface Comment {
  id: number;
  post_id: number;
  author_account_id: number | null;
  author_name: string;
  body: string;
  status: string;
  parent_comment_id: number | null;
  created_at: string;
  updated_at: string;
  replies?: Comment[];
}

interface KeywordRule {
  id: number;
  owner_account_id: number;
  phrase: string;
  match_mode: string;
  scope: string;
  action: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

// ---------------------------------------------------------------------------
// Shared Layout
// ---------------------------------------------------------------------------

const SHARED_CSS = `
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #333; }
a { text-decoration: none; color: #1a73e8; }
button { cursor: pointer; border: none; border-radius: 6px; padding: 8px 16px; font-size: 14px; background: #1a73e8; color: white; }
button:hover { opacity: 0.9; }
button.secondary { background: #e0e0e0; color: #333; }
button.danger { background: #dc3545; }
input, textarea, select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
.navbar { background: #1a73e8; padding: 12px 24px; display: flex; gap: 20px; align-items: center; }
.navbar a { color: white; font-weight: 500; }
.navbar .brand { font-size: 20px; font-weight: bold; }
.container { max-width: 900px; margin: 0 auto; padding: 20px; }
.card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-title { font-size: 18px; font-weight: 600; }
.meta { color: #666; font-size: 13px; }
.tag { display: inline-block; background: #e3f2fd; color: #1a73e8; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 6px; }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid #ddd; margin-bottom: 16px; }
.tab { padding: 10px 16px; cursor: pointer; border-bottom: 2px solid transparent; }
.tab.active { border-bottom-color: #1a73e8; color: #1a73e8; font-weight: 500; }
.post-content { font-size: 15px; line-height: 1.6; margin: 12px 0; }
.post-actions { display: flex; gap: 16px; margin-top: 12px; }
.post-actions button { background: none; color: #666; padding: 4px 8px; font-size: 13px; }
.post-actions button:hover { background: #f0f0f0; }
.post-actions button.active { color: #1a73e8; }
.avatar { width: 40px; height: 40px; border-radius: 50%; background: #1a73e8; color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; }
.avatar-large { width: 80px; height: 80px; font-size: 32px; }
.search-form { display: flex; gap: 8px; margin-bottom: 16px; }
.search-form input { flex: 1; }
.empty { text-align: center; padding: 40px; color: #999; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.stat-box { text-align: center; padding: 16px; background: #f8f9fa; border-radius: 8px; }
.stat-value { font-size: 24px; font-weight: 600; color: #1a73e8; }
.stat-label { font-size: 12px; color: #666; margin-top: 4px; }
.comment { padding: 12px; border-left: 3px solid #1a73e8; margin: 8px 0; background: #f8f9fa; border-radius: 0 8px 8px 0; }
.comment-reply { margin-left: 32px; }
.comment-form { display: flex; gap: 8px; margin-top: 12px; }
.comment-form input { flex: 1; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.calendar-day { aspect-ratio: 1; background: white; border-radius: 6px; padding: 8px; font-size: 12px; }
.calendar-day.has-post { background: #e3f2fd; }
.login-box { max-width: 400px; margin: 80px auto; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.login-box h1 { text-align: center; margin-bottom: 24px; }
.login-box input { width: 100%; margin-bottom: 12px; }
.login-box button { width: 100%; padding: 12px; }
.composer { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
.composer textarea { width: 100%; min-height: 100px; resize: vertical; }
.asset-preview { display: flex; gap: 8px; margin: 8px 0; }
.asset-preview img { width: 100px; height: 75px; object-fit: cover; border-radius: 6px; }
.pagination { display: flex; gap: 8px; justify-content: center; margin-top: 20px; }
.pagination a, .pagination span { padding: 6px 12px; border-radius: 6px; }
.pagination span { background: #1a73e8; color: white; }
.pagination a { background: white; color: #333; }
.rule-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #f8f9fa; border-radius: 8px; margin-bottom: 8px; }
.rule-item.inactive { opacity: 0.6; }
.metric-chart { height: 200px; background: #f8f9fa; border-radius: 8px; display: flex; align-items: flex-end; justify-content: space-around; padding: 16px; }
.metric-bar { width: 40px; background: #1a73e8; border-radius: 4px 4px 0 0; min-height: 4px; }
`;

const Layout: FC<{ title: string; children: Child; scripts?: string; account?: Account | null; activeNav?: string }> = ({ title, children, scripts, account, activeNav }) => {
  const navLink = (href: string, label: string) =>
    html`<a href="${href}" class="${activeNav === href ? "active-nav" : ""}">${label}</a>`;

  const seedAccounts = [
    { id: 1, name: "mosi_brand" },
    { id: 2, name: "alice" },
    { id: 3, name: "bob_creator" },
    { id: 4, name: "carol_ops" },
  ];

  return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>${raw(SHARED_CSS)}
.active-nav { text-decoration: underline; font-weight: 700; }
.dropdown { position: relative; display: inline-block; }
.dropdown-content { display: none; position: absolute; background: white; min-width: 160px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px; z-index: 10; right: 0; }
.dropdown-content a { color: #333; padding: 10px 16px; display: block; font-weight: 400; }
.dropdown-content a:hover { background: #f0f0f0; }
.dropdown:hover .dropdown-content { display: block; }
</style>
</head>
<body>
<nav class="navbar">
  <a href="/home" class="brand">Mosi Social</a>
  ${navLink("/home", "Home")}
  ${navLink("/compose", "Compose")}
  ${navLink("/discover", "Discover")}
  ${navLink("/management", "Management")}
  ${navLink("/calendar", "Calendar")}
  ${navLink("/analytics", "Analytics")}
  ${navLink("/settings/moderation", "Moderation")}
  ${account
    ? html`<div class="dropdown">
           <a href="/profile" style="color:white;font-weight:600;">${escHtml(account.display_name)}</a>
           <div class="dropdown-content">
             <a href="/profile">Profile</a>
             ${seedAccounts.map((sa) => html`<a href="#" onclick="switchAccount(${sa.id});return false;">Switch to ${sa.name}</a>`).join("")}
             <a href="#" onclick="logout();return false;">Logout</a>
           </div>
         </div>`
    : html`<a href="/">Login</a>`}
</nav>
<div class="container">
${children}
</div>
${scripts ? html`<script>${raw(scripts)}</script>` : ""}
<script>
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/';
}
async function switchAccount(accountId) {
  const res = await fetch('/api/auth/switch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account_id: accountId })
  });
  if (res.ok) { window.location.reload(); }
  else { alert('Switch failed'); }
}
</script>
</body>
</html>`;
};

// ---------------------------------------------------------------------------
// Page Components
// ---------------------------------------------------------------------------

// --- / Login page ---
const LoginPage: FC = () => {
  return html`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Login - Mosi Social</title>
<style>${raw(SHARED_CSS)}</style>
</head>
<body>
<div class="login-box">
  <h1>Mosi Social</h1>
  <form id="loginForm">
    <input type="text" id="username" placeholder="Username" required />
    <input type="password" id="password" placeholder="Password" required />
    <button type="submit">Login</button>
  </form>
  <p class="meta" style="text-align:center;margin-top:16px;">Demo accounts: mosi_brand, alice, bob_creator, carol_ops<br>Password: demo123</p>
</div>
<script>
document.getElementById('loginForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      window.location.href = '/home';
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
});
</script>
</body>
</html>`;
};

// --- /home Feed ---
const HomePage: FC<{ posts: any[]; account: Account }> = ({ posts, account }) => {
  const postEls = posts.map((p) => {
    const tags = (p.tags as Tag[]).map((t) => <span class="tag">{t.label_text}</span>);
    const assets = (p.assets as PostAsset[]).map((a) =>
      a.asset_type === "image" ? <img src={a.asset_url} alt={a.alt_text || ""} /> : <div class="asset-preview"><a href={a.asset_url} target="_blank">Link Preview</a></div>
    );
    return <div class="card">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="avatar">{(p.author_display_name as string).charAt(0)}</div>
          <div>
            <div class="card-title">{p.author_display_name}</div>
            <div class="meta">@{p.author_username} &middot; {p.created_at}</div>
          </div>
        </div>
        {p.is_pinned ? <span class="tag">Pinned</span> : null}
      </div>
      <div class="post-content">{p.content}</div>
      {assets.length > 0 ? <div class="asset-preview">{assets}</div> : null}
      {tags.length > 0 ? <div>{tags}</div> : null}
      <div class="post-actions">
        <button class={p.liked ? "active" : ""} onclick={`likePost(${p.id})`}>{p.liked ? "Liked" : "Like"} ({p.like_count})</button>
        <button class={p.reposted ? "active" : ""} onclick={`repostPost(${p.id})`}>{p.reposted ? "Reposted" : "Repost"} ({p.repost_count})</button>
        <button onclick={`location.href='/posts/${p.id}'`}>Reply ({p.reply_count})</button>
        {p.author_account_id === account.id ? <button onclick={`pinPost(${p.id})`}>{p.is_pinned ? "Unpin" : "Pin"}</button> : null}
      </div>
    </div>;
  });

  return <Layout title="Home" account={account} scripts={`
async function submitPost() {
  const content = document.getElementById('composerContent').value;
  const visibility = document.getElementById('composerVisibility').value;
  if (!content.trim()) { alert('Content is required'); return; }
  const body = { content, visibility, status: 'published' };
  try {
    const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) { location.href = '/home'; }
    else { alert(data.error || 'Failed to create post'); }
  } catch (err) { alert('Error: ' + err.message); }
}
async function likePost(id) {
  const res = await fetch('/api/posts/' + id + '/like', { method: 'POST' });
  if (res.ok) location.reload();
}
async function repostPost(id) {
  const res = await fetch('/api/posts/' + id + '/repost', { method: 'POST' });
  if (res.ok) location.reload();
}
async function pinPost(id) {
  const res = await fetch('/api/posts/' + id + '/pin', { method: 'POST' });
  if (res.ok) location.reload();
}
`}>
    <div class="composer">
      <h3>What's on your mind?</h3>
      <textarea id="composerContent" placeholder="Write something..."></textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
        <select id="composerVisibility">
          <option value="public">Public</option>
          <option value="followers_only">Followers Only</option>
          <option value="unlisted">Unlisted</option>
        </select>
        <button onclick="submitPost()">Post</button>
      </div>
    </div>
    {postEls.length > 0 ? postEls : <div class="empty">No posts yet.</div>}
  </Layout>;
};

// --- /compose ---
const ComposePage: FC<{ account: Account }> = ({ account }) => {
  return <Layout title="Compose" account={account} scripts={`
async function submitPost() {
  const content = document.getElementById('content').value;
  const visibility = document.getElementById('visibility').value;
  const status = document.getElementById('status').value;
  const scheduledFor = document.getElementById('scheduled_for').value;
  const tags = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t);
  if (!content.trim()) { alert('Content is required'); return; }
  const body = { content, visibility, status, tags };
  if (status === 'scheduled' && scheduledFor) body.scheduled_for = scheduledFor;
  try {
    const res = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok) { location.href = '/home'; }
    else { alert(data.error || 'Failed to create post'); }
  } catch (err) { alert('Error: ' + err.message); }
}
`}>
    <div class="card">
      <h2>Create Post</h2>
      <textarea id="content" placeholder="What's on your mind?"></textarea>
      <div class="grid-2" style="margin-top:12px;">
        <div>
          <label>Visibility</label>
          <select id="visibility">
            <option value="public">Public</option>
            <option value="followers_only">Followers Only</option>
            <option value="unlisted">Unlisted</option>
          </select>
        </div>
        <div>
          <label>Status</label>
          <select id="status">
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
      </div>
      <div style="margin-top:12px;">
        <label>Scheduled For (if scheduled)</label>
        <input type="datetime-local" id="scheduled_for" />
      </div>
      <div style="margin-top:12px;">
        <label>Tags (comma-separated)</label>
        <input type="text" id="tags" placeholder="tag1, tag2, tag3" />
      </div>
      <button style="margin-top:16px;" onclick="submitPost()">Create Post</button>
    </div>
  </Layout>;
};

// --- /posts/:id Detail ---
const PostDetailPage: FC<{ post: any; comments: Comment[]; account: Account | null }> = ({ post, comments, account }) => {
  const tags = (post.tags as Tag[]).map((t) => <span class="tag">{t.label_text}</span>);
  const assets = (post.assets as PostAsset[]).map((a) =>
    a.asset_type === "image" ? <img src={a.asset_url} alt={a.alt_text || ""} /> : <div class="asset-preview"><a href={a.asset_url} target="_blank">Link Preview</a></div>
  );

  const renderComments = (list: Comment[], depth = 0): Child[] => {
    return list.map((c) => <div class={depth > 0 ? "comment comment-reply" : "comment"}>
      <div class="meta"><strong>{c.author_name}</strong> &middot; {c.created_at}</div>
      <div>{c.body}</div>
      <div class="post-actions">
        <button onclick={`replyTo(${c.id})`}>Reply</button>
        {account && c.author_account_id === account.id ? <button class="danger" onclick={`deleteComment(${c.id})`}>Delete</button> : null}
      </div>
      <div id={`reply-form-${c.id}`} style="display:none;margin-top:8px;">
        <div class="comment-form">
          <input type="text" id={`reply-input-${c.id}`} placeholder="Write a reply..." />
          <button onclick={`submitReply(${c.id})`}>Reply</button>
        </div>
      </div>
      {c.replies && c.replies.length > 0 ? renderComments(c.replies, depth + 1) : null}
    </div>);
  };

  return <Layout title="Post Detail" account={account} scripts={`
async function likePost(id) {
  const res = await fetch('/api/posts/' + id + '/like', { method: 'POST' });
  if (res.ok) location.reload();
}
async function repostPost(id) {
  const res = await fetch('/api/posts/' + id + '/repost', { method: 'POST' });
  if (res.ok) location.reload();
}
async function pinPost(id) {
  const res = await fetch('/api/posts/' + id + '/pin', { method: 'POST' });
  if (res.ok) location.reload();
}
async function deletePost(id) {
  if (!confirm('Delete this post?')) return;
  const res = await fetch('/api/posts/' + id, { method: 'DELETE' });
  if (res.ok) location.href = '/home';
}
async function restorePost(id) {
  const res = await fetch('/api/posts/' + id + '/restore', { method: 'POST' });
  if (res.ok) location.reload();
}
async function submitComment() {
  const body = document.getElementById('commentBody').value;
  if (!body.trim()) return;
  const res = await fetch('/api/posts/${post.id}/comments', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body })
  });
  if (res.ok) location.reload();
}
function replyTo(id) {
  const el = document.getElementById('reply-form-' + id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
async function submitReply(id) {
  const body = document.getElementById('reply-input-' + id).value;
  if (!body.trim()) return;
  const res = await fetch('/api/comments/' + id + '/reply', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body })
  });
  if (res.ok) location.reload();
}
async function deleteComment(id) {
  if (!confirm('Delete this comment?')) return;
  const res = await fetch('/api/comments/' + id, { method: 'DELETE' });
  if (res.ok) location.reload();
}
`}>
    <div class="card">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:12px;">
          <div class="avatar">{(post.author_display_name as string).charAt(0)}</div>
          <div>
            <div class="card-title">{post.author_display_name}</div>
            <div class="meta">@{post.author_username} &middot; {post.created_at} &middot; {post.status}</div>
          </div>
        </div>
        {post.is_pinned ? <span class="tag">Pinned</span> : null}
        {post.moderation_state === "flagged" ? <span class="tag" style="background:#ffebee;color:#c62828;">Flagged</span> : null}
      </div>
      <div class="post-content">{post.content}</div>
      {assets.length > 0 ? <div class="asset-preview">{assets}</div> : null}
      {tags.length > 0 ? <div>{tags}</div> : null}
      <div class="post-actions">
        <button class={post.liked ? "active" : ""} onclick={`likePost(${post.id})`}>{post.liked ? "Liked" : "Like"} ({post.like_count})</button>
        <button class={post.reposted ? "active" : ""} onclick={`repostPost(${post.id})`}>{post.reposted ? "Reposted" : "Repost"} ({post.repost_count})</button>
        <span class="meta">{post.impressions} impressions</span>
      </div>
      {account && post.author_account_id === account.id ? <div class="post-actions" style="margin-top:8px;">
        <button onclick={`pinPost(${post.id})`}>{post.is_pinned ? "Unpin" : "Pin"}</button>
        {post.status === "deleted" ? <button onclick={`restorePost(${post.id})`}>Restore</button> : <button class="danger" onclick={`deletePost(${post.id})`}>Delete</button>}
        <button onclick={`location.href='/management'`}>Edit</button>
      </div> : null}
    </div>

    <div class="card">
      <h3>Comments ({comments.length})</h3>
      <div class="comment-form">
        <input type="text" id="commentBody" placeholder="Write a comment..." />
        <button onclick="submitComment()">Comment</button>
      </div>
      {comments.length > 0 ? renderComments(comments) : <div class="empty">No comments yet.</div>}
    </div>
  </Layout>;
};

// --- /management ---
const ManagementPage: FC<{ posts: any[]; account: Account; tab: string }> = ({ posts, account, tab }) => {
  const postEls = posts.map((p) => <div class="card">
    <div class="card-header">
      <div>
        <span class="card-title">{p.content.substring(0, 80)}{p.content.length > 80 ? "..." : ""}</span>
        <div class="meta">{p.created_at} &middot; {p.visibility} &middot; {p.status}</div>
      </div>
      <div>
        {p.is_pinned ? <span class="tag">Pinned</span> : null}
        {p.moderation_state === "flagged" ? <span class="tag" style="background:#ffebee;color:#c62828;">Flagged</span> : null}
      </div>
    </div>
    <div class="post-actions">
      <button onclick={`location.href='/posts/${p.id}'`}>View</button>
      <button onclick={`location.href='/posts/${p.id}'`}>Edit</button>
      {p.status === "deleted" ? <button onclick={`restorePost(${p.id})`}>Restore</button> : <button class="danger" onclick={`deletePost(${p.id})`}>Delete</button>}
    </div>
  </div>);

  const tabs = ["all", "published", "draft", "scheduled", "deleted"];
  const tabEls = tabs.map((t) => <a href={`/management?tab=${t}`} class={t === tab ? "tab active" : "tab"}>{t.charAt(0).toUpperCase() + t.slice(1)}</a>);

  return <Layout title="Management" account={account} scripts={`
async function deletePost(id) {
  if (!confirm('Delete this post?')) return;
  const res = await fetch('/api/posts/' + id, { method: 'DELETE' });
  if (res.ok) location.reload();
}
async function restorePost(id) {
  const res = await fetch('/api/posts/' + id + '/restore', { method: 'POST' });
  if (res.ok) location.reload();
}
`}>
    <h2>Post Management</h2>
    <div class="tabs">{tabEls}</div>
    {postEls.length > 0 ? postEls : <div class="empty">No posts in this category.</div>}
  </Layout>;
};

// --- /calendar ---
const CalendarPage: FC<{ posts: any[]; account: Account; year: number; month: number }> = ({ posts, account, year, month }) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const postDates = new Map<number, any[]>();
  for (const p of posts) {
    const d = p.scheduled_for ? new Date(p.scheduled_for) : new Date(p.created_at);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!postDates.has(day)) postDates.set(day, []);
      postDates.get(day)!.push(p);
    }
  }

  const days: Child[] = [];
  for (let i = 0; i < firstDay; i++) days.push(<div class="calendar-day" style="background:transparent;"></div>);
  for (let d = 1; d <= daysInMonth; d++) {
    const dayPosts = postDates.get(d) || [];
    days.push(<div class={dayPosts.length > 0 ? "calendar-day has-post" : "calendar-day"}>
      <div style="font-weight:600;margin-bottom:4px;">{d}</div>
      {dayPosts.map((p) => <div style="font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        <a href={`/posts/${p.id}`}>{p.content.substring(0, 30)}{p.content.length > 30 ? "..." : ""}</a>
      </div>)}
    </div>);
  }

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  return <Layout title="Calendar" account={account}>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <h2>Calendar</h2>
      <div>
        <a href={`/calendar?year=${prevYear}&month=${prevMonth}`}>&larr; Prev</a>
        <span style="margin:0 16px;font-weight:600;">{year}-{String(month + 1).padStart(2, "0")}</span>
        <a href={`/calendar?year=${nextYear}&month=${nextMonth}`}>Next &rarr;</a>
      </div>
    </div>
    <div class="calendar-grid">{days}</div>
  </Layout>;
};

// --- /discover ---
const DiscoverPage: FC<{ accounts: any[]; account: Account; q: string }> = ({ accounts, account, q }) => {
  const els = accounts.map((a) => <div class="card">
    <div style="display:flex;align-items:center;gap:16px;">
      <div class="avatar avatar-large">{a.display_name.charAt(0)}</div>
      <div style="flex:1;">
        <div class="card-title">{a.display_name}</div>
        <div class="meta">@{a.username} &middot; {a.account_type}</div>
        <div>{a.bio || ""}</div>
      </div>
      <button onclick={`location.href='/profile/${a.id}'`}>View Profile</button>
    </div>
  </div>);

  return <Layout title="Discover" account={account}>
    <h2>Discover People</h2>
    <form action="/discover" method="get" class="search-form">
      <input type="text" name="q" value={q} placeholder="Search by username or display name..." />
      <button type="submit">Search</button>
    </form>
    {els.length > 0 ? els : <div class="empty">No accounts found.</div>}
  </Layout>;
};

// --- /settings/moderation ---
const ModerationPage: FC<{ rules: KeywordRule[]; account: Account }> = ({ rules, account }) => {
  const ruleEls = rules.map((r) => <div class={r.is_active ? "rule-item" : "rule-item inactive"}>
    <div>
      <strong>{r.phrase}</strong>
      <div class="meta">{r.match_mode} &middot; {r.scope} &middot; action: {r.action} &middot; {r.is_active ? "Active" : "Inactive"}</div>
    </div>
    <div>
      <button onclick={`toggleRule(${r.id})`}>{r.is_active ? "Deactivate" : "Activate"}</button>
      <button class="danger" onclick={`deleteRule(${r.id})`}>Delete</button>
    </div>
  </div>);

  return <Layout title="Moderation" account={account} scripts={`
async function toggleRule(id) {
  const res = await fetch('/api/keyword-rules/' + id + '/toggle', { method: 'POST' });
  if (res.ok) location.reload();
}
async function deleteRule(id) {
  if (!confirm('Delete this rule?')) return;
  const res = await fetch('/api/keyword-rules/' + id, { method: 'DELETE' });
  if (res.ok) location.reload();
}
async function createRule() {
  const phrase = document.getElementById('phrase').value;
  const matchMode = document.getElementById('match_mode').value;
  const scope = document.getElementById('scope').value;
  const action = document.getElementById('action').value;
  if (!phrase.trim()) { alert('Phrase is required'); return; }
  const res = await fetch('/api/keyword-rules', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phrase, match_mode: matchMode, scope, action })
  });
  if (res.ok) location.reload();
  else { const d = await res.json(); alert(d.error || 'Failed'); }
}
`}>
    <h2>Keyword Rules</h2>
    <div class="card">
      <h3>Create Rule</h3>
      <div class="grid-2">
        <input type="text" id="phrase" placeholder="Phrase to match" />
        <select id="match_mode">
          <option value="contains">Contains</option>
          <option value="exact">Exact</option>
          <option value="prefix">Prefix</option>
        </select>
        <select id="scope">
          <option value="post">Post</option>
          <option value="comment">Comment</option>
        </select>
        <select id="action">
          <option value="warn">Warn</option>
          <option value="hide">Hide</option>
          <option value="block">Block</option>
        </select>
      </div>
      <button style="margin-top:12px;" onclick="createRule()">Create Rule</button>
    </div>
    {ruleEls.length > 0 ? ruleEls : <div class="empty">No rules yet.</div>}
  </Layout>;
};

// --- /analytics ---
const AnalyticsPage: FC<{ metrics: any[]; events: any[]; account: Account }> = ({ metrics, events, account }) => {
  const metricCards = metrics.map((m) => <div class="card">
    <div class="card-header">
      <div class="card-title">Post #{m.post_id}</div>
      <div class="meta">{m.content.substring(0, 60)}{m.content.length > 60 ? "..." : ""}</div>
    </div>
    <div class="grid-3">
      <div class="stat-box"><div class="stat-value">{m.impressions}</div><div class="stat-label">Impressions</div></div>
      <div class="stat-box"><div class="stat-value">{m.likes}</div><div class="stat-label">Likes</div></div>
      <div class="stat-box"><div class="stat-value">{m.replies}</div><div class="stat-label">Replies</div></div>
      <div class="stat-box"><div class="stat-value">{m.reposts}</div><div class="stat-label">Reposts</div></div>
      <div class="stat-box"><div class="stat-value">{m.clicks}</div><div class="stat-label">Clicks</div></div>
      <div class="stat-box"><div class="stat-value">{m.profile_visits}</div><div class="stat-label">Profile Visits</div></div>
    </div>
  </div>);

  const eventRows = events.slice(0, 50).map((e) => <tr>
    <td>{e.post_id}</td>
    <td>{e.action_type}</td>
    <td>{e.old_value || "-"}</td>
    <td>{e.new_value || "-"}</td>
    <td>{e.created_at}</td>
  </tr>);

  return <Layout title="Analytics" account={account}>
    <h2>Analytics</h2>
    <h3>Post Metrics</h3>
    {metricCards.length > 0 ? metricCards : <div class="empty">No metrics available.</div>}
    <h3>Recent Events</h3>
    <div class="card">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="border-bottom:2px solid #ddd;">
            <th style="text-align:left;padding:8px;">Post</th>
            <th style="text-align:left;padding:8px;">Action</th>
            <th style="text-align:left;padding:8px;">Old</th>
            <th style="text-align:left;padding:8px;">New</th>
            <th style="text-align:left;padding:8px;">Time</th>
          </tr>
        </thead>
        <tbody>{eventRows}</tbody>
      </table>
    </div>
  </Layout>;
};

// --- /profile ---
const ProfilePage: FC<{ profile: Account; isSelf: boolean; isFollowing: boolean; isBlocked: boolean; followerCount: number; followingCount: number; postCount: number; posts: any[] }> = ({ profile, isSelf, isFollowing, isBlocked, followerCount, followingCount, postCount, posts }) => {
  const postEls = posts.map((p) => <div class="card">
    <div class="post-content">{p.content.substring(0, 120)}{p.content.length > 120 ? "..." : ""}</div>
    <div class="meta">{p.created_at} &middot; {p.visibility} &middot; {p.status}</div>
    <div class="post-actions">
      <button onclick={`location.href='/posts/${p.id}'`}>View</button>
    </div>
  </div>);

  return <Layout title={profile.display_name} account={isSelf ? profile : null} scripts={`
async function followUser() {
  const res = await fetch('/api/accounts/${profile.id}/follow', { method: 'POST' });
  if (res.ok) location.reload();
}
async function blockUser() {
  if (!confirm('Block this user?')) return;
  const res = await fetch('/api/accounts/${profile.id}/block', { method: 'POST' });
  if (res.ok) location.reload();
}
async function updateProfile() {
  const displayName = document.getElementById('display_name').value;
  const bio = document.getElementById('bio').value;
  const location = document.getElementById('location').value;
  const website = document.getElementById('website').value;
  const res = await fetch('/api/accounts/${profile.id}', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ display_name: displayName, bio, location, website_url: website })
  });
  if (res.ok) location.reload();
  else { const d = await res.json(); alert(d.error || 'Failed'); }
}
`}>
    <div class="card">
      <div style="display:flex;align-items:center;gap:20px;">
        <div class="avatar avatar-large">{profile.display_name.charAt(0)}</div>
        <div style="flex:1;">
          <h1 style="margin:0;">{profile.display_name}</h1>
          <div class="meta">@{profile.username} &middot; {profile.account_type}</div>
          <div style="margin-top:8px;">{profile.bio || "No bio yet."}</div>
          {profile.location ? <div class="meta">Location: {profile.location}</div> : null}
          {profile.website_url ? <div class="meta">Website: <a href={profile.website_url} target="_blank">{profile.website_url}</a></div> : null}
        </div>
        <div class="grid-3" style="width:300px;">
          <div class="stat-box"><div class="stat-value">{postCount}</div><div class="stat-label">Posts</div></div>
          <div class="stat-box"><div class="stat-value">{followerCount}</div><div class="stat-label">Followers</div></div>
          <div class="stat-box"><div class="stat-value">{followingCount}</div><div class="stat-label">Following</div></div>
        </div>
      </div>
      {!isSelf ? <div class="post-actions" style="margin-top:16px;">
        <button onclick="followUser()">{isFollowing ? "Unfollow" : "Follow"}</button>
        <button class="danger" onclick="blockUser()">{isBlocked ? "Unblock" : "Block"}</button>
      </div> : null}
    </div>

    {isSelf ? <div class="card">
      <h3>Edit Profile</h3>
      <div class="grid-2">
        <div>
          <label>Display Name</label>
          <input type="text" id="display_name" value={profile.display_name} />
        </div>
        <div>
          <label>Location</label>
          <input type="text" id="location" value={profile.location || ""} />
        </div>
      </div>
      <div style="margin-top:12px;">
        <label>Bio</label>
        <textarea id="bio">{profile.bio || ""}</textarea>
      </div>
      <div style="margin-top:12px;">
        <label>Website</label>
        <input type="text" id="website" value={profile.website_url || ""} />
      </div>
      <button style="margin-top:12px;" onclick="updateProfile()">Save Profile</button>
    </div> : null}

    <h3>Posts</h3>
    {postEls.length > 0 ? postEls : <div class="empty">No posts yet.</div>}
  </Layout>;
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  LoginPage,
  HomePage,
  ComposePage,
  PostDetailPage,
  ManagementPage,
  CalendarPage,
  DiscoverPage,
  ModerationPage,
  AnalyticsPage,
  ProfilePage,
  Layout,
  SHARED_CSS,
};
