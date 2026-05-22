"""CLI: python -m citation_analyzer run --papers .. --edges .. --seeds .. --out .."""

from __future__ import annotations

import argparse
import json
import sys

from citation_analyzer import (
    detect_cascades,
    load_graph,
    pagerank,
    write_outputs,
    yearly_top,
)


def cmd_run(args):
    g = load_graph(args.papers, args.edges)
    pr = pagerank(g)
    with open(args.seeds) as f:
        seeds = json.load(f)
    cascades = detect_cascades(g, seeds)
    yt = yearly_top(g, k=10)
    write_outputs(g, pr, cascades, yt, args.out)
    print(
        f"papers={g['n_papers']} edges={g['n_edges']} cascades={len(cascades)} years={len(yt)}"
    )
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(prog="citation_analyzer")
    sub = parser.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("run")
    p.add_argument("--papers", required=True)
    p.add_argument("--edges", required=True)
    p.add_argument("--seeds", required=True)
    p.add_argument("--out", required=True)
    p.set_defaults(func=cmd_run)
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
