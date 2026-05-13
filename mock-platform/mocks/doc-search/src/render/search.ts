/**
 * Search results page renderer
 */

import type { Document, Metadata } from "../types";
import { escHtml, renderPage } from "./html";

export function renderSearch(
  metadata: Metadata,
  query: string,
  results: Array<Document & { rank_score?: number }>,
  sid: string,
): string {
  const resultCards = results.map((doc, idx) => {
    const rank = idx + 1;
    const pills = [
      `<span class="pill">${escHtml(doc.status)}</span>`,
      `<span class="pill">${escHtml(doc.reliability)}</span>`,
      `<span class="pill">${escHtml(doc.kind)}</span>`,
      `<span class="pill">${escHtml(doc.updated_at)}</span>`,
    ].join(" ");

    return `<div class="doc-card">
<p class="meta">Result ${rank}</p>
<h2 class="result-title">${escHtml(doc.title)}</h2>
${pills}
<p class="summary">${escHtml(doc.summary)}</p>
<a class="open-link" href="/docs/${encodeURIComponent(doc.slug)}?sid=${encodeURIComponent(sid)}&rank=${rank}">Open result</a>
</div>`;
  }).join("\n");

  return renderPage(metadata, `Search: ${query}`, `
<h1>Search Results</h1>
<p class="meta">Query: <code>${escHtml(query)}</code></p>
<p class="meta">Search session: <code>${escHtml(sid)}</code></p>
<form action="/search" method="get">
<input type="text" name="q" value="${escHtml(query)}">
<button type="submit">Search</button>
</form>
${results.length > 0 ? resultCards : "<p>No documents matched this query.</p>"}
<p><a href="/">Back to home</a></p>`);
}
