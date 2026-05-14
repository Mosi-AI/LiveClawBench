import type { Database } from "bun:sqlite";
import type { Account, Post, PostAsset, PostMetric, Tag, Comment } from "./index";

/**
 * Escape SQLite LIKE wildcards (`%`, `_`) and the escape char itself so a
 * user-supplied search string is matched literally. Pair with `ESCAPE '\\'`
 * in the SQL template, e.g. `column LIKE ? ESCAPE '\\'`.
 *
 * Without this, a search for "100%" or "user_1" would behave as a wildcard
 * pattern and surface unrelated rows.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export function getAccountById(db: Database, id: number): Account | null {
  return db.query("SELECT * FROM account WHERE id = ?").get(id) as Account | null;
}

export function getAccountByUsername(db: Database, username: string): Account | null {
  return db.query("SELECT * FROM account WHERE username = ?").get(username) as Account | null;
}

export function getPostById(db: Database, id: number): Post | null {
  return db.query("SELECT * FROM post WHERE id = ?").get(id) as Post | null;
}

export function getPostTags(db: Database, postId: number): Tag[] {
  return db.query(`
    SELECT t.* FROM tag t
    JOIN post_tag pt ON pt.tag_id = t.id
    WHERE pt.post_id = ?
    ORDER BY pt.sort_order
  `).all(postId) as Tag[];
}

export function getPostAssets(db: Database, postId: number): PostAsset[] {
  return db.query(`
    SELECT * FROM post_asset WHERE post_id = ? ORDER BY sort_order
  `).all(postId) as PostAsset[];
}

export function getPostMetrics(db: Database, postId: number): PostMetric | null {
  return db.query("SELECT * FROM post_metric WHERE post_id = ?").get(postId) as PostMetric | null;
}

export function getCommentsForPost(db: Database, postId: number): Comment[] {
  return db.query(`
    SELECT * FROM comment WHERE post_id = ? ORDER BY created_at ASC
  `).all(postId) as Comment[];
}

export function getCommentReplies(db: Database, parentId: number): Comment[] {
  return db.query(`
    SELECT * FROM comment WHERE parent_comment_id = ? ORDER BY created_at ASC
  `).all(parentId) as Comment[];
}

export function buildCommentTree(db: Database, comments: Comment[]): Comment[] {
  const map = new Map<number, Comment>();
  const roots: Comment[] = [];
  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }
  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parent_comment_id === null) {
      roots.push(node);
    } else {
      const parent = map.get(c.parent_comment_id);
      if (parent) {
        parent.replies!.push(node);
      } else {
        roots.push(node);
      }
    }
  }
  return roots;
}

export function buildVisibilityAwareCommentTree(db: Database, postId: number): Comment[] {
  // Read ALL comments (including hidden/deleted)
  const allComments = db.query(`
    SELECT * FROM comment WHERE post_id = ? ORDER BY created_at ASC
  `).all(postId) as Comment[];

  const parentMap = new Map<number, number | null>();
  for (const c of allComments) {
    parentMap.set(c.id, c.parent_comment_id);
  }

  function nearestVisibleAncestor(commentId: number): number | null {
    const parentId = parentMap.get(commentId);
    if (parentId === null || parentId === undefined) return null;
    const parent = allComments.find((c) => c.id === parentId);
    if (!parent) return null;
    if (parent.status === "visible") return parentId;
    return nearestVisibleAncestor(parentId);
  }

  const visibleComments = allComments.filter((c) => c.status === "visible");
  const rootComments: Comment[] = [];
  const childrenMap = new Map<number, Comment[]>();

  for (const c of visibleComments) {
    const ancestorId = nearestVisibleAncestor(c.id);
    c.replies = [];
    if (ancestorId === null) {
      rootComments.push(c);
    } else {
      const siblings = childrenMap.get(ancestorId) || [];
      siblings.push(c);
      childrenMap.set(ancestorId, siblings);
    }
  }

  function attachReplies(comments: Comment[]) {
    for (const c of comments) {
      const children = childrenMap.get(c.id) || [];
      c.replies = children;
      attachReplies(children);
    }
  }
  attachReplies(rootComments);
  return rootComments;
}

export function getFollowerCount(db: Database, accountId: number): number {
  const row = db.query(
    "SELECT COUNT(*) as cnt FROM follow_relation WHERE target_account_id = ? AND status = 'following'"
  ).get(accountId) as { cnt: number } | null;
  return row?.cnt ?? 0;
}

export function getFollowingCount(db: Database, accountId: number): number {
  const row = db.query(
    "SELECT COUNT(*) as cnt FROM follow_relation WHERE follower_account_id = ? AND status = 'following'"
  ).get(accountId) as { cnt: number } | null;
  return row?.cnt ?? 0;
}

export function getPostCount(db: Database, accountId: number): number {
  const row = db.query(
    "SELECT COUNT(*) as cnt FROM post WHERE author_account_id = ? AND status != 'deleted'"
  ).get(accountId) as { cnt: number } | null;
  return row?.cnt ?? 0;
}

export function isLiked(db: Database, postId: number, accountId: number): boolean {
  const row = db.query(
    "SELECT 1 as ok FROM post_like WHERE post_id = ? AND account_id = ?"
  ).get(postId, accountId) as { ok: number } | null;
  return !!row;
}

export function isReposted(db: Database, postId: number, accountId: number): boolean {
  const row = db.query(
    "SELECT 1 as ok FROM post_repost WHERE post_id = ? AND account_id = ?"
  ).get(postId, accountId) as { ok: number } | null;
  return !!row;
}

export function normalizeTag(label: string): string {
  return label.toLowerCase().replace(/^#/, "").replace(/\s+/g, "");
}
