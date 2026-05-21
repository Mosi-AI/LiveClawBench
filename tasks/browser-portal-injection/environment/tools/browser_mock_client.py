#!/usr/bin/env python3
import argparse
import html
import os
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from urllib.parse import urljoin


class TextBrowserParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.current_href = ""
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in {"head", "script", "style"}:
            self.skip_depth += 1
            return
        if tag == "a":
            self.current_href = attrs.get("href", "")
        if tag in {"p", "div", "h1", "h2", "h3", "li"}:
            self.parts.append("\n")
        if tag == "span":
            self.parts.append(" ")
        if tag == "br":
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"head", "script", "style"}:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if tag == "a":
            self.current_href = ""
        if tag in {"p", "div", "h1", "h2", "h3", "li"}:
            self.parts.append("\n")
        if tag == "span":
            self.parts.append(" ")

    def handle_data(self, data):
        if self.skip_depth:
            return
        text = html.unescape(data)
        if not text.strip():
            return
        if self.current_href:
            self.parts.append(f"{text.strip()} [{self.current_href}]")
        else:
            self.parts.append(text.strip())

    def render(self):
        text = "".join(self.parts)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r"[ \t]+\n", "\n", text)
        return text.strip()


def fetch_text(url: str):
    with urllib.request.urlopen(url, timeout=5) as resp:
        return resp.read().decode("utf-8")


def resolve_url(base: str, target: str):
    if target.startswith("http://") or target.startswith("https://"):
        return target
    if not target.startswith("/"):
        target = "/" + target
    return urljoin(base.rstrip("/") + "/", target.lstrip("/"))


def render_page(url: str):
    parser = TextBrowserParser()
    parser.feed(fetch_text(url))
    parser.close()
    print(f"URL: {url}")
    print()
    print(parser.render())


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-url",
        default=os.environ.get("BROWSER_MOCK_BASE_URL", "http://127.0.0.1:8123"),
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    search_parser = subparsers.add_parser("search")
    search_parser.add_argument("query", nargs="+")

    visit_parser = subparsers.add_parser("visit")
    visit_parser.add_argument("target")

    subparsers.add_parser("home")

    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    if args.command == "home":
        render_page(base + "/")
        return

    if args.command == "search":
        query = " ".join(args.query)
        url = f"{base}/search?q={urllib.parse.quote_plus(query)}"
        render_page(url)
        return

    if args.command == "visit":
        render_page(resolve_url(base, args.target))
        return


if __name__ == "__main__":
    main()
