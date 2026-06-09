/**
 * Prefix an app-relative path with the configured Astro `base`.
 *
 * - Pass paths like `/tasks`, `/logo.png`, `/data?case=x`, or `tasks/${slug}`.
 * - Returns a URL that works both on GitHub Pages (`/LiveClawBench/...`) and
 *   on Netlify / local preview (`/...`).
 * - Leaves absolute URLs (`http://`, `https://`, `mailto:`, `#`) untouched.
 */
export function withBase(path: string): string {
  if (!path) return path;
  if (/^([a-z]+:)?\/\//i.test(path) || path.startsWith('mailto:') || path.startsWith('#')) {
    return path;
  }
  const base = import.meta.env.BASE_URL || '/';
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}
