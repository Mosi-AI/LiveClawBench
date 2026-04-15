#!/usr/bin/env python3
"""
Search algorithm parity test — Python side.

Runs calculate_relevance_score() from the original Python shop app
against the golden fixture queries specified in the implementation plan.

Usage (from repo root):
  python3 mock-platform/docs/evidence/search-parity-test.py

Output: JSON with query results to stdout.
"""

import json
import sys
import os
import re
from collections import Counter

# Resolve product data path relative to repo root
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PRODUCTS_PATH = os.path.join(
    REPO_ROOT,
    "tasks/watch-shop/environment/shop-app/frontend/data/sample_products.json",
)

# Golden fixtures from the implementation plan (AC-5.1)
GOLDEN_QUERIES = ["smart watch", "washer", "toilet paper", "stapler"]


def calculate_relevance_score(query: str, product: dict) -> float:
    """Exact copy of calculate_relevance_score from app.py."""
    query_lower = query.lower()
    query_words = query_lower.split()
    title = product.get("title", "").lower()
    title_words = title.split()
    score = 0.0

    # Exact title match
    if title == query_lower:
        score += 100

    # Word match + position bonus
    for i, q_word in enumerate(query_words):
        for j, t_word in enumerate(title_words):
            if t_word == q_word:
                score += 20 + max(0, 10 - j)
                break

    # Partial/substring match
    for q_word in query_words:
        if len(q_word) >= 3:
            for t_word in title_words:
                if q_word in t_word and t_word != q_word:
                    score += 10
                    break

    # Query coverage
    matched = sum(1 for w in query_words if w in title)
    coverage = matched / len(query_words) if query_words else 0
    score += 30 * coverage

    # Word frequency
    word_freq = Counter(title_words)
    freq_boost = sum(min(word_freq.get(w, 0) * 5, 20) for w in query_words)
    score += freq_boost

    # Quality boost
    rating = product.get("rating", 0)
    score += rating * 2
    if product.get("best_seller"):
        score += 15
    if product.get("overall_pick"):
        score += 15

    return score


def filter_and_sort_products(query: str, products: list, min_relevance: float = 10.0):
    """Filter and sort products by relevance score."""
    results = []
    for p in products:
        score = calculate_relevance_score(query, p)
        if score >= min_relevance:
            results.append({"id": p["id"], "title": p["title"], "score": score})

    results.sort(key=lambda x: x["score"], reverse=True)

    # Fallback: retry with min_relevance=0 if no results
    if not results and min_relevance > 0:
        return filter_and_sort_products(query, products, min_relevance=0.0)

    return results


def main():
    with open(PRODUCTS_PATH) as f:
        products = json.load(f)

    print(f"# Product count: {len(products)}", file=sys.stderr)

    output = {"product_count": len(products), "queries": {}}
    for query in GOLDEN_QUERIES:
        results = filter_and_sort_products(query, products)
        output["queries"][query] = results
        print(f"# Query: {query!r} → {len(results)} results", file=sys.stderr)

    json.dump(output, sys.stdout, indent=2)


if __name__ == "__main__":
    main()
