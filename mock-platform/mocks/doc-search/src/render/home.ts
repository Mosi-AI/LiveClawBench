/**
 * Home page renderer
 */

import type { Metadata } from "../types";
import { escHtml, renderPage } from "./html";

export function renderHome(metadata: Metadata, queryExamples: string[]): string {
  const queryListHtml = queryExamples.map((q) => `<li><code>${escHtml(q)}</code></li>`).join("\n");

  return renderPage(metadata, metadata.home_title, `
<h1>${escHtml(metadata.home_title)}</h1>
<p>${escHtml(metadata.home_description)}</p>
<form action="/search" method="get">
<input type="text" name="q" placeholder="${escHtml(metadata.search_placeholder)}">
<button type="submit">Search</button>
</form>
<p>Use the search page, inspect result cards, and open result links to review individual pages.</p>
<h2>Suggested queries</h2>
<ul>
${queryListHtml}
</ul>`);
}
