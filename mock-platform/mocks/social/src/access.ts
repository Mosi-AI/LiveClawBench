import type { Database } from "bun:sqlite";

// Valid state transitions per spec
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["scheduled", "published"],
  scheduled: ["published", "draft"],
  published: ["deleted"],
  deleted: ["draft"],
};

export function validateTransition(current: string, next: string): boolean {
  const allowed = VALID_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

export function isFollowing(db: Database, followerId: number, targetId: number): boolean {
  const row = db.query(
    "SELECT 1 as ok FROM follow_relation WHERE follower_account_id = ? AND target_account_id = ? AND status = 'following'"
  ).get(followerId, targetId) as { ok: number } | null;
  return !!row;
}

export function isBlocked(db: Database, blockerId: number, targetId: number): boolean {
  const row = db.query(
    "SELECT 1 as ok FROM follow_relation WHERE follower_account_id = ? AND target_account_id = ? AND status = 'blocked'"
  ).get(blockerId, targetId) as { ok: number } | null;
  return !!row;
}

export function getBlockedIds(db: Database, userId: number): number[] {
  const rows = db.query(
    "SELECT target_account_id as id FROM follow_relation WHERE follower_account_id = ? AND status = 'blocked'"
  ).all(userId) as Array<{ id: number }>;
  return rows.map((r) => r.id);
}

/**
 * Returns "allow" | "403" | "404" for detail-read access.
 * 404 hides existence of draft/scheduled/deleted posts from non-authors.
 * 403 is for followers_only posts where viewer is not a follower.
 * Blocked-author detail also returns 404.
 */
export function visibilityCode(
  post: { status: string; visibility: string; author_account_id: number },
  viewerId: number | undefined,
  db: Database
): "allow" | "403" | "404" {
  // Bidirectional block check: either direction hides existence
  if (viewerId) {
    if (isBlocked(db, post.author_account_id, viewerId)) return "404";
    if (isBlocked(db, viewerId, post.author_account_id)) return "404";
  }
  // Non-public statuses: only author can see
  if (post.status === "deleted" || post.status === "draft" || post.status === "scheduled") {
    return viewerId === post.author_account_id ? "allow" : "404";
  }
  // Public visibility: anyone
  if (post.visibility === "public") return "allow";
  // Unlisted: direct access allowed
  if (post.visibility === "unlisted") return "allow";
  // Followers_only: need to be follower or author
  if (post.visibility === "followers_only") {
    if (!viewerId) return "403";
    if (viewerId === post.author_account_id) return "allow";
    return isFollowing(db, viewerId, post.author_account_id) ? "allow" : "403";
  }
  return "allow";
}

/**
 * Returns parameterized WHERE clause for feed listing.
 * Anonymous: published/public only.
 * Authenticated: published/public + published/followers_only from followed accounts + own non-deleted posts.
 * Unlisted is EXCLUDED from feed. Deleted posts are excluded by default;
 * pass includeDeleted=true AND viewerId to also include the viewer's own deleted posts.
 */
export function feedVisibilityWhere(
  viewerId: number | undefined,
  includeDeleted?: boolean
): { sql: string; params: any[] } {
  if (!viewerId) {
    return {
      sql: "p.status = 'published' AND p.visibility = 'public'",
      params: [],
    };
  }
  const ownDeletedClause =
    includeDeleted && viewerId
      ? `OR (p.author_account_id = ? AND p.status = 'deleted')`
      : "";
  return {
    sql: `
      p.visibility != 'unlisted'
      AND (
        (p.status = 'published' AND p.visibility = 'public')
        OR (p.status = 'published' AND p.visibility = 'followers_only'
          AND EXISTS (
            SELECT 1 FROM follow_relation fr
            WHERE fr.follower_account_id = ?
            AND fr.target_account_id = p.author_account_id
            AND fr.status = 'following'
          )
        )
        OR (p.author_account_id = ? AND p.status != 'deleted')
        ${ownDeletedClause}
      )
    `,
    params: includeDeleted && viewerId ? [viewerId, viewerId, viewerId] : [viewerId, viewerId],
  };
}

/**
 * Returns list of author IDs that should be excluded from the viewer's feed
 * because of bidirectional block relationships.
 */
export function applyBlockFilter(db: Database, viewerId: number | undefined): number[] {
  if (!viewerId) return [];
  // Authors that the viewer has blocked
  const blockedOut = getBlockedIds(db, viewerId);
  // Authors that have blocked the viewer
  const rows = db.query(
    "SELECT follower_account_id as id FROM follow_relation WHERE target_account_id = ? AND status = 'blocked'"
  ).all(viewerId) as Array<{ id: number }>;
  const blockedIn = rows.map((r) => r.id);
  return [...new Set([...blockedOut, ...blockedIn])];
}
