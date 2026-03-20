import type { APIRoute } from 'astro';
import { getDatabase } from '../../../lib/database';

export const POST: APIRoute = async () => {
  try {
    const db = getDatabase();

    // Clear post authors
    db.prepare('UPDATE posts SET author_id = NULL').run();

    // Delete all users
    const result = db.prepare('DELETE FROM users').run();

    return new Response(JSON.stringify({
      success: true,
      deleted: result.changes
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
