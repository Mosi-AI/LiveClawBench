#!/usr/bin/env python3
"""
Search algorithm parity test — Python side.

Extracts and runs the REAL calculate_relevance_score() from the original
Python shop app (tasks/watch-shop/environment/shop-app/backend/app.py)
by parsing the function definition via AST, NOT a reimplementation.

Usage (from repo root):
  python3 mock-platform/docs/evidence/search-parity-test.py

Output: JSON with query results to stdout.
"""

import json
import sys
import os
import ast
import re
from collections import Counter

# Resolve paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", ".."))
PRODUCTS_PATH = os.path.join(
    REPO_ROOT,
    "tasks/watch-shop/environment/shop-app/frontend/data/sample_products.json",
)
APP_PY_PATH = os.path.join(
    REPO_ROOT,
    "tasks/watch-shop/environment/shop-app/backend/app.py",
)

# Golden fixtures from the implementation plan (AC-5.1)
GOLDEN_QUERIES = ["smart watch", "washer", "toilet paper", "stapler"]


def extract_function_from_file(source_path, func_name):
    """Extract a function definition from a source file by parsing its AST."""
    with open(source_path) as f:
        source = f.read()
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name == func_name:
            func_source = ast.get_source_segment(source, node)
            local_ns = {"re": re, "Counter": Counter}
            builtins = {"Dict": dict, "Any": object, "List": list, "Tuple": tuple,
                        "Optional": type(None), "ceil": __import__("math").ceil,
                        "datetime": __import__("datetime").datetime}
            local_ns.update(builtins)
            compile(func_source, source_path, "exec")
            exec(func_source, local_ns)  # noqa: S102 — extracting from trusted source
            return local_ns[func_name]
    raise ValueError(f"Function {func_name} not found in {source_path}")


def run_parity_test():
    # Extract the REAL function from app.py
    calculate_relevance_score = extract_function_from_file(APP_PY_PATH, "calculate_relevance_score")

    with open(PRODUCTS_PATH) as f:
        products = json.load(f)

    print(f"# Product count: {len(products)}", file=sys.stderr)
    print(f"# Using REAL calculate_relevance_score from {APP_PY_PATH}", file=sys.stderr)
    print(f"# Function tokenization: re.findall(r'\\w+', ...)", file=sys.stderr)

    output = {"product_count": len(products), "source": APP_PY_PATH, "queries": {}}
    for query in GOLDEN_QUERIES:
        results = []
        for p in products:
            score = calculate_relevance_score(p, query)
            if score >= 10.0:
                results.append({"id": p["id"], "title": p["title"], "score": score})

        results.sort(key=lambda x: x["score"], reverse=True)

        # Fallback: retry with min_relevance=0 if no results
        if not results:
            for p in products:
                score = calculate_relevance_score(p, query)
                if score > 0:
                    results.append({"id": p["id"], "title": p["title"], "score": score})
            results.sort(key=lambda x: x["score"], reverse=True)

        output["queries"][query] = results
        print(f"# Query: {query!r} -> {len(results)} results", file=sys.stderr)

    json.dump(output, sys.stdout, indent=2)


if __name__ == "__main__":
    run_parity_test()
