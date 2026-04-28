/**
 * Document page renderer
 */

import type { Document, Metadata } from "../types";
import { escHtml, renderPage } from "./html";

export function renderDoc(metadata: Metadata, doc: Document, sid: string, rank: string): string {
  const pills = [
    `source: ${escHtml(doc.id)}`,
    `status: ${escHtml(doc.status)}`,
    `reliability: ${escHtml(doc.reliability)}`,
    `kind: ${escHtml(doc.kind)}`,
    `updated: ${escHtml(doc.updated_at)}`,
    `owner: ${escHtml(doc.owner)}`,
  ].map((p) => `<span class="pill">${p}</span>`).join("\n");

  let sessionRow = "";
  if (sid) {
    sessionRow = `<p class="meta">search session: ${escHtml(sid)}</p>
<p class="meta">rank: ${escHtml(rank || "?")}</p>`;
  }

  // Split body on double newlines into paragraphs
  // SQL seeds store literal \n\n escapes — normalize before splitting
  const normalizedBody = doc.body.replace(/\\n/g, "\n");
  const paragraphs = normalizedBody.split("\n\n").map((p) => `<p>${escHtml(p.trim())}</p>`).join("\n");

  // Split tags on pipe
  const tagPills = doc.tags.split("|").map((t) => t.trim()).filter((t) => t).map((t) => `<span class="pill">${escHtml(t)}</span>`).join(" ");

  return renderPage(metadata, doc.title, `
<h1 class="doc-title">${escHtml(doc.title)}</h1>
${pills}
${sessionRow}
<p class="summary"><strong>Summary:</strong> ${escHtml(doc.summary)}</p>
<div class="doc-body">
${paragraphs}
</div>
<p class="meta">Tags: ${tagPills}</p>
<p><a href="/">Back to home</a></p>`);
}
