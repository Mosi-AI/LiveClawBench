function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const ALLOWED_SCHEMES = ["http:", "https:", "mailto:"];

function isAllowedUrl(url: string): boolean {
  if (url.startsWith("/") || url.startsWith("#")) return true;
  for (const scheme of ALLOWED_SCHEMES) {
    if (url.toLowerCase().startsWith(scheme)) return true;
  }
  return false;
}

export function renderMarkdown(input: string): string {
  // Step 1: Escape all raw HTML
  let text = escapeHtml(input);

  // Step 2: Apply formatting replacements (bold before italic)
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Step 3: Links — after bold/italic so inline formatting in link text works
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, linkText, url) => {
    if (isAllowedUrl(url)) {
      return `<a href="${escapeHtml(url)}">${linkText}</a>`;
    }
    return linkText;
  });

  // Step 4: Split into lines and process block-level elements
  const lines = text.split("\n");
  const blocks: string[] = [];
  let currentParagraph: string[] = [];

  function flushParagraph() {
    if (currentParagraph.length > 0) {
      blocks.push(`<p>${currentParagraph.join(" ")}</p>`);
      currentParagraph = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line.length === 0) {
      flushParagraph();
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      flushParagraph();
      blocks.push(`<h3>${line.slice(4)}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push(`<h2>${line.slice(3)}</h2>`);
      continue;
    }
    if (line.startsWith("# ")) {
      flushParagraph();
      blocks.push(`<h1>${line.slice(2)}</h1>`);
      continue;
    }

    // Unordered lists
    if (line.startsWith("- ")) {
      flushParagraph();
      blocks.push(`<ul><li>${line.slice(2)}</li></ul>`);
      continue;
    }

    currentParagraph.push(line);
  }
  flushParagraph();

  return blocks.join("\n");
}

export function renderPlainText(input: string): string {
  const escaped = escapeHtml(input);
  const paragraphs = escaped.split("\n\n").map((p) => p.trim()).filter((p) => p.length > 0);
  return paragraphs.map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`).join("\n");
}
