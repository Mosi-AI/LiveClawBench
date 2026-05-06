/**
 * Query tokenization helpers
 *
 * Faithful ports of Python normalize/tokenize/build_match_query.
 */

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalize(text);
  if (!normalized) return [];
  return normalized.split(" ").filter((t) => t.length > 0);
}

export function buildMatchQuery(tokens: string[]): string {
  // Deduplicate while preserving first occurrence order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      unique.push(t);
    }
  }
  // Render each token as "token"* (wildcard suffix)
  return unique.map((t) => `"${t}"*`).join(" OR ");
}
