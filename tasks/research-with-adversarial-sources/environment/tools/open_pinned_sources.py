#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path


def main() -> int:
    pinned_path = Path(sys.argv[1] if len(sys.argv) > 1 else "corpus/pinned.json")
    payload = json.loads(pinned_path.read_text(encoding="utf-8"))
    urls = [
        payload.get("paper", ""),
        payload.get("video", ""),
        payload.get("announcement", ""),
    ]
    urls = [url for url in urls if isinstance(url, str) and url.strip()]
    if not urls:
        raise SystemExit("no pinned URLs found")

    for url in urls:
        subprocess.run(["openclaw", "browser", "open", url], check=True)

    subprocess.run(["openclaw", "browser", "tabs", "--json"], check=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
