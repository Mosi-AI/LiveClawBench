#!/usr/bin/env python3
"""
Search algorithm parity test — Python side.

Calls the REAL production functions from the original Python shop app
(tasks/watch-shop/environment/shop-app/backend/app.py) by extracting
calculate_relevance_score(), search_products(), AND filter_and_sort_products()
via AST, then invoking them against the real product data.

This proves AC-5.1 score parity by:
1. Comparing per-product scores from calculate_relevance_score()
2. Comparing final ordered IDs from filter_and_sort_products()

Usage (from repo root):
  python3 mock-platform/docs/evidence/search-parity-test.py

Output: JSON with per-product scores and final filter flow results to stdout.
"""

import ast
import json
import os
import re
import sys
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


def extract_functions_from_file(source_path, func_names):
    """Extract function definitions from a source file by parsing AST."""
    with open(source_path) as f:
        source = f.read()
    tree = ast.parse(source)
    functions = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef) and node.name in func_names:
            func_source = ast.get_source_segment(source, node)
            functions[node.name] = func_source
    return functions


def run_parity_test():
    # Extract the REAL functions from app.py
    func_sources = extract_functions_from_file(
        APP_PY_PATH,
        ["calculate_relevance_score", "search_products", "filter_and_sort_products"],
    )

    if len(func_sources) < 2:
        missing = {
            "calculate_relevance_score",
            "search_products",
            "filter_and_sort_products",
        } - set(func_sources.keys())
        raise ValueError(
            f"Could not extract functions from {APP_PY_PATH}: missing {missing}"
        )

    # Build a namespace with all dependencies needed by the functions
    local_ns = {"re": re, "Counter": Counter}
    builtins = {
        "Dict": dict,
        "Any": object,
        "List": list,
        "Tuple": tuple,
        "Optional": type(None),
        "ceil": __import__("math").ceil,
        "datetime": __import__("datetime").datetime,
    }
    local_ns.update(builtins)

    # Compile and exec functions in dependency order
    # calculate_relevance_score has no deps on other functions
    exec(func_sources["calculate_relevance_score"], local_ns)
    calculate_relevance_score = local_ns["calculate_relevance_score"]

    # search_products calls calculate_relevance_score
    exec(func_sources["search_products"], local_ns)
    search_products = local_ns["search_products"]

    # filter_and_sort_products calls search_products
    exec(func_sources["filter_and_sort_products"], local_ns)
    filter_and_sort_products = local_ns["filter_and_sort_products"]

    with open(PRODUCTS_PATH) as f:
        products = json.load(f)

    print(f"# Product count: {len(products)}", file=sys.stderr)
    print(f"# Using REAL functions from {APP_PY_PATH}:", file=sys.stderr)
    print("#   - calculate_relevance_score()", file=sys.stderr)
    print("#   - search_products()", file=sys.stderr)
    print("#   - filter_and_sort_products()", file=sys.stderr)

    output = {
        "product_count": len(products),
        "source": APP_PY_PATH,
        "functions_used": [
            "calculate_relevance_score",
            "search_products",
            "filter_and_sort_products",
        ],
        "queries": {},
    }

    for query in GOLDEN_QUERIES:
        # 1. Per-product scores from calculate_relevance_score
        per_product_scores = {}
        for p in products:
            score = calculate_relevance_score(p, query)
            if score >= 10.0:
                per_product_scores[p["id"]] = score

        # 2. search_products results (applies threshold + sort)
        scored = search_products(products, query)
        search_results = [{"id": p["id"], "score": s} for p, s in scored]

        # 3. filter_and_sort_products results (full production flow)
        sorted_products = filter_and_sort_products(products, query=query)
        filter_results = [{"id": p["id"], "title": p["title"]} for p in sorted_products]

        output["queries"][query] = {
            "per_product_scores": per_product_scores,
            "search_products_count": len(search_results),
            "search_products_top10": search_results[:10],
            "filter_and_sort_count": len(filter_results),
            "filter_and_sort_ids": [r["id"] for r in filter_results],
            "filter_and_sort_top10": filter_results[:10],
        }
        print(
            f"# Query: {query!r} -> {len(search_results)} scored, "
            f"{len(filter_results)} filtered/sorted",
            file=sys.stderr,
        )

    json.dump(output, sys.stdout, indent=2)


if __name__ == "__main__":
    run_parity_test()
