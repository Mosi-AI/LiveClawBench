import type { APIRoute } from 'astro';
import { postQueries } from '../../lib/database';
import { checkApiAuth, requireAdmin } from '../../lib/auth';

export const GET: APIRoute = async ({ url }) => {
  const status = url.searchParams.get('status') || undefined;
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const posts = postQueries.findAll({ status: status as any, limit, offset });

  return new Response(JSON.stringify(posts), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  // Check auth
  const user = checkApiAuth(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await request.json();
    const postId = postQueries.create(data);

    return new Response(JSON.stringify({ id: postId, success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
