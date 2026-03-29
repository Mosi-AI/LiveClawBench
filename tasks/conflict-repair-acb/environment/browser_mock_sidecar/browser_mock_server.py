#!/usr/bin/env python3
import argparse
import html
import itertools
import json
import re
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, List
from urllib.parse import parse_qs, quote, urlparse


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", text.lower())).strip()


def tokenize(text: str) -> List[str]:
    return [tok for tok in normalize(text).split() if tok]


def build_match_query(query_tokens: List[str]) -> str:
    unique_tokens = list(dict.fromkeys(query_tokens))
    return " OR ".join(f'"{token}"*' for token in unique_tokens)


def row_to_doc(row: sqlite3.Row) -> Dict[str, object]:
    body = row["body"].replace("\\n\\n", "\n\n")
    return {
        "id": row["id"],
        "slug": row["slug"],
        "title": row["title"],
        "kind": row["kind"],
        "status": row["status"],
        "reliability": row["reliability"],
        "updated_at": row["updated_at"],
        "owner": row["owner"],
        "summary": row["summary"],
        "body": body.split("\n\n"),
        "tags": [part.strip() for part in row["tags"].split("|")],
    }


class BrowserMockHandler(BaseHTTPRequestHandler):
    site_title: str = "Browser Mock"
    home_title: str = "Browser Mock"
    home_description: str = (
        "This sidecar-backed site simulates a searchable internal knowledge portal."
    )
    search_placeholder: str = "Search the portal"
    query_examples: List[str] = []
    db_path: Path = Path("/tmp/browser_mock.sqlite")
    log_path: Path = Path("/tmp/browser_mock_access.jsonl")
    search_counter = itertools.count(1)

    def log_message(self, format: str, *args):
        return

    def write_event(self, event: Dict[str, object]) -> None:
        BrowserMockHandler.log_path.parent.mkdir(parents=True, exist_ok=True)
        with BrowserMockHandler.log_path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(event, ensure_ascii=False) + "\n")

    def send_html(self, status: int, body: str) -> None:
        payload = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, status: int, payload: Dict[str, object]) -> None:
        blob = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(blob)))
        self.end_headers()
        self.wfile.write(blob)

    def page(self, title: str, inner_html: str) -> str:
        site_title = html.escape(BrowserMockHandler.site_title)
        return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>{html.escape(title)}</title>
    <style>
      body {{
        font-family: Georgia, "Times New Roman", serif;
        margin: 2rem auto;
        max-width: 940px;
        padding: 0 1.25rem 3rem;
        background: #f5f1e8;
        color: #1f1a14;
      }}
      a {{ color: #0f4c5c; }}
      .meta {{
        color: #5a5246;
        font-size: 0.95rem;
      }}
      .doc-card {{
        border: 1px solid #cbbba0;
        background: #fffaf1;
        padding: 1rem 1.1rem;
        margin: 1rem 0;
      }}
      .pill {{
        display: inline-block;
        padding: 0.1rem 0.45rem;
        margin-right: 0.4rem;
        border: 1px solid #c3ad87;
        border-radius: 999px;
        font-size: 0.85rem;
        background: #f3e2bf;
      }}
      .summary {{
        margin-top: 0.7rem;
      }}
      .open-link {{
        font-weight: bold;
      }}
      code {{
        background: #efe4d0;
        padding: 0.08rem 0.3rem;
      }}
      form {{
        margin: 1.2rem 0 1.4rem;
      }}
      input[type="text"] {{
        width: 70%;
        padding: 0.55rem 0.65rem;
        border: 1px solid #aa9a82;
        font-size: 1rem;
      }}
      button {{
        padding: 0.58rem 0.9rem;
        border: 1px solid #6b5a45;
        background: #1f4d4f;
        color: #fffaf1;
        cursor: pointer;
      }}
      ul {{
        line-height: 1.5;
      }}
      .doc-body p {{
        margin-bottom: 0.9rem;
      }}
    </style>
  </head>
  <body>
    <p class="meta">{site_title}</p>
    {inner_html}
  </body>
</html>
"""

    def render_home(self) -> str:
        query_examples = BrowserMockHandler.query_examples
        items = "".join(
            f"<li><code>{html.escape(str(item))}</code></li>" for item in query_examples
        )
        home_title = html.escape(BrowserMockHandler.home_title)
        home_description = html.escape(BrowserMockHandler.home_description)
        search_placeholder = html.escape(BrowserMockHandler.search_placeholder)
        return self.page(
            BrowserMockHandler.home_title,
            f"""
<h1>{home_title}</h1>
<p>{home_description}</p>
<form action="/search" method="get">
  <input type="text" name="q" placeholder="{search_placeholder}" />
  <button type="submit">Search</button>
</form>
<p class="meta">Use the search page, inspect result cards, and open result links to review individual pages.</p>
<h2>Suggested queries</h2>
<ul>{items}</ul>
""",
        )

    def render_search(
        self, query: str, sid: str, results: List[Dict[str, object]]
    ) -> str:
        if results:
            cards = []
            for rank, doc in enumerate(results, start=1):
                link = f"/docs/{quote(str(doc['slug']))}?sid={sid}&rank={rank}"
                cards.append(
                    f"""
<div class="doc-card">
  <p class="meta">Result {rank}</p>
  <h2 class="result-title">{html.escape(str(doc["title"]))}</h2>
  <p class="meta">
    <span class="pill">status: {html.escape(str(doc["status"]))}</span>
    <span class="pill">reliability: {html.escape(str(doc["reliability"]))}</span>
    <span class="pill">kind: {html.escape(str(doc["kind"]))}</span>
    <span class="pill">updated: {html.escape(str(doc["updated_at"]))}</span>
  </p>
  <p class="summary">{html.escape(str(doc["summary"]))}</p>
  <p><a class="open-link" href="{html.escape(link)}">Open result</a></p>
</div>
"""
                )
            results_html = "".join(cards)
        else:
            results_html = "<p>No documents matched this query.</p>"

        return self.page(
            f"Search: {query}",
            f"""
<h1>Search Results</h1>
<p class="meta">Query: <code>{html.escape(query)}</code></p>
<p class="meta">Search session: <code>{html.escape(sid)}</code></p>
<form action="/search" method="get">
  <input type="text" name="q" value="{html.escape(query)}" />
  <button type="submit">Search</button>
</form>
{results_html}
<p><a href="/">Back to home</a></p>
""",
        )

    def render_doc(self, doc: Dict[str, object], sid: str, rank: str) -> str:
        body_html = "".join(
            f"<p>{html.escape(str(part))}</p>" for part in doc.get("body", [])
        )
        tags = "".join(
            f'<span class="pill">{html.escape(str(tag))}</span>'
            for tag in doc.get("tags", [])
        )
        session_html = ""
        if sid:
            session_html = f"""
<p class="meta">
  <span class="pill">search session: {html.escape(sid)}</span>
  <span class="pill">rank: {html.escape(rank or "?")}</span>
</p>
"""
        return self.page(
            str(doc["title"]),
            f"""
<h1 class="doc-title">{html.escape(str(doc["title"]))}</h1>
<p class="meta">
  <span class="pill">source: {html.escape(str(doc["id"]))}</span>
  <span class="pill">status: {html.escape(str(doc["status"]))}</span>
  <span class="pill">reliability: {html.escape(str(doc["reliability"]))}</span>
  <span class="pill">kind: {html.escape(str(doc["kind"]))}</span>
  <span class="pill">updated: {html.escape(str(doc["updated_at"]))}</span>
  <span class="pill">owner: {html.escape(str(doc["owner"]))}</span>
</p>
{session_html}
<p class="summary"><strong>Summary:</strong> {html.escape(str(doc["summary"]))}</p>
<div class="doc-body">{body_html}</div>
<p class="meta">Tags: {tags}</p>
<p><a href="/">Back to home</a></p>
""",
        )

    def handle_search(self, query: str) -> None:
        query_tokens = tokenize(query)
        if query_tokens:
            match_query = build_match_query(query_tokens)
        else:
            match_query = ""

        with sqlite3.connect(BrowserMockHandler.db_path) as conn:
            conn.row_factory = sqlite3.Row
            if match_query:
                rows = conn.execute(
                    """
                    SELECT d.*, bm25(documents_fts, 10.0, 6.0, 2.0, 3.0) AS rank_score
                    FROM documents_fts
                    JOIN documents d ON d.rowid = documents_fts.rowid
                    WHERE documents_fts MATCH ?
                    ORDER BY rank_score ASC,
                             CASE d.reliability WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                             d.title ASC
                    LIMIT 8
                    """,
                    (match_query,),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT *
                    FROM documents
                    ORDER BY CASE reliability WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                             title ASC
                    LIMIT 8
                    """
                ).fetchall()

        results = [row_to_doc(row) for row in rows]
        sid = f"search_{next(BrowserMockHandler.search_counter):04d}"
        self.write_event(
            {
                "event": "search",
                "sid": sid,
                "path": self.path,
                "query": query,
                "results": [
                    {"rank": rank, "doc_id": doc["id"], "slug": doc["slug"]}
                    for rank, doc in enumerate(results, start=1)
                ],
            }
        )
        self.send_html(200, self.render_search(query, sid, results))

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/health":
            self.send_json(200, {"ok": True})
            return

        if parsed.path == "/":
            self.write_event({"event": "home", "path": self.path})
            self.send_html(200, self.render_home())
            return

        if parsed.path == "/search":
            query = params.get("q", [""])[0]
            self.handle_search(query)
            return

        if parsed.path.startswith("/docs/"):
            slug = parsed.path.split("/", 2)[-1]
            with sqlite3.connect(BrowserMockHandler.db_path) as conn:
                conn.row_factory = sqlite3.Row
                row = conn.execute(
                    "SELECT * FROM documents WHERE slug = ?",
                    (slug,),
                ).fetchone()
            if row is None:
                self.send_html(404, self.page("Not Found", "<h1>Not Found</h1>"))
                return
            doc = row_to_doc(row)

            sid = params.get("sid", [""])[0]
            rank = params.get("rank", [""])[0]
            if sid:
                self.write_event(
                    {
                        "event": "click",
                        "sid": sid,
                        "rank": rank,
                        "path": self.path,
                        "doc_id": doc["id"],
                        "slug": doc["slug"],
                    }
                )
            self.write_event(
                {
                    "event": "page",
                    "sid": sid,
                    "rank": rank,
                    "path": self.path,
                    "doc_id": doc["id"],
                    "slug": doc["slug"],
                }
            )
            self.send_html(200, self.render_doc(doc, sid, rank))
            return

        self.send_html(404, self.page("Not Found", "<h1>Not Found</h1>"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True)
    parser.add_argument("--log", required=True)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8123)
    args = parser.parse_args()

    BrowserMockHandler.db_path = Path(args.database)
    with sqlite3.connect(BrowserMockHandler.db_path) as conn:
        conn.row_factory = sqlite3.Row
        metadata = {
            row["key"]: row["value"]
            for row in conn.execute("SELECT key, value FROM metadata").fetchall()
        }
        BrowserMockHandler.site_title = metadata.get(
            "site_title", BrowserMockHandler.site_title
        )
        BrowserMockHandler.home_title = metadata.get(
            "home_title", BrowserMockHandler.site_title
        )
        BrowserMockHandler.home_description = metadata.get(
            "home_description",
            BrowserMockHandler.home_description,
        )
        BrowserMockHandler.search_placeholder = metadata.get(
            "search_placeholder",
            BrowserMockHandler.search_placeholder,
        )
        BrowserMockHandler.query_examples = [
            row["query"]
            for row in conn.execute(
                "SELECT query FROM query_examples ORDER BY position ASC"
            ).fetchall()
        ]
    BrowserMockHandler.log_path = Path(args.log)

    server = ThreadingHTTPServer((args.host, args.port), BrowserMockHandler)
    try:
        server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
