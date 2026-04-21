/**
 * Search algorithm — faithful port of Python calculate_relevance_score(),
 * search_products(), and filter_and_sort_products() from
 * tasks/watch-shop/environment/shop-app/backend/app.py.
 *
 * Extracted into a standalone module for shared usage by the Hono shop mock
 * (index.tsx imports from here) and Layer 1 unit tests.
 *
 * Scoring factor reference (calculateRelevanceScore):
 * | Factor | Range | Description |
 * |--------|-------|-------------|
 * | Exact title match | +100 | Query lowercased == title lowercased |
 * | Exact word match | +20 + positionBonus | Per query word found in title; positionBonus = max(0, 10 - firstIndex) |
 * | Partial word match | +10 | Query substring (3+ chars) inside a title word |
 * | Coverage | +0–30 | (matchedQueryWords / totalQueryWords) * 30 |
 * | Word frequency | +0–20 | min(freq * 5, 20) per matched query word |
 * | Rating | +0–10 | rating * 2 |
 * | Best seller | +15 | If product.best_seller is true |
 * | Overall pick | +15 | If product.overall_pick is true |
 */

export interface SearchableProduct {
  id: string;
  title: string;
  price: number;
  rating: number;
  best_seller?: boolean;
  overall_pick?: boolean;
}

export interface FilterOptions {
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: "similarity" | "price_asc" | "price_desc" | "rating";
  useSearch?: boolean;
}

// ---------------------------------------------------------------------------
// calculate_relevance_score — faithful port of Python app.py lines 310–390
// ---------------------------------------------------------------------------

export function calculateRelevanceScore(
  product: SearchableProduct,
  query: string,
): number {
  if (!query || !query.trim()) return 0.0;

  const queryLower = query.toLowerCase().trim();
  const title = (product.title ?? "").toLowerCase();
  if (!title) return 0.0;

  let score = 0.0;

  // Exact title match
  if (queryLower === title) {
    score += 100.0;
  }

  // Tokenize query and title using \w+ (matches [a-zA-Z0-9_])
  const queryWords = queryLower.match(/\w+/g) ?? [];
  const titleWords = title.match(/\w+/g) ?? [];

  if (!queryWords.length || !titleWords.length) return score;

  // Count word frequencies
  const titleWordCount = new Map<string, number>();
  for (const w of titleWords) {
    titleWordCount.set(w, (titleWordCount.get(w) ?? 0) + 1);
  }

  // Exact word matches
  let matchedWords = 0;
  for (const qWord of queryWords) {
    if ((titleWords as readonly string[]).includes(qWord)) {
      matchedWords++;
      const positions: number[] = [];
      for (let i = 0; i < titleWords.length; i++) {
        if (titleWords[i] === qWord) positions.push(i);
      }
      if (positions.length > 0) {
        const positionBonus = Math.max(0, 10 - positions[0]);
        score += 20 + positionBonus;
      }
    }
  }

  // Partial word matches (substring, 3+ chars only)
  for (const qWord of queryWords) {
    if (qWord.length >= 3) {
      for (const tWord of titleWords) {
        if (qWord !== tWord && tWord.includes(qWord)) {
          score += 10;
          break;
        }
      }
    }
  }

  // Coverage: percentage of query words found
  const coverage = matchedWords / queryWords.length;
  score += coverage * 30;

  // Word frequency boost
  for (const qWord of queryWords) {
    const freq = titleWordCount.get(qWord) ?? 0;
    if (freq > 0) {
      score += Math.min(freq * 5, 20);
    }
  }

  // Product quality boosts
  score += (product.rating ?? 0) * 2;
  if (product.best_seller) score += 15;
  if (product.overall_pick) score += 15;

  return score;
}

// ---------------------------------------------------------------------------
// search_products — faithful port of Python app.py lines 393–414
// ---------------------------------------------------------------------------

export function searchProducts<T extends SearchableProduct>(
  products: T[],
  query: string,
  minRelevance = 10.0,
): [T, number][] {
  if (!query || !query.trim()) {
    return products.map((p) => [p, 0.0] as [T, number]);
  }

  const scored: [T, number][] = [];
  for (const product of products) {
    const relevance = calculateRelevanceScore(product, query);
    if (relevance >= minRelevance) {
      scored.push([product, relevance]);
    }
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored;
}

// ---------------------------------------------------------------------------
// filter_and_sort_products — faithful port of Python app.py lines 417–480
// ---------------------------------------------------------------------------

export function filterAndSortProducts<T extends SearchableProduct>(
  sourceProducts: T[],
  opts: FilterOptions,
): T[] {
  const {
    query,
    minPrice,
    maxPrice,
    minRating,
    sortBy = "similarity",
    useSearch = true,
  } = opts;

  let products = [...sourceProducts];
  let productsWithScores = new Map<string, number>();

  // Step 1: Apply search
  if (query && query.trim() && useSearch) {
    let scored = searchProducts(products, query, 10.0);
    productsWithScores = new Map(scored.map(([p, s]) => [p.id, s]));
    products = scored.map(([p]) => p);

    // If no results, retry with lower threshold (matching Python app.py behavior:
    // Python retries against the already-empty products list, so this always
    // returns no results — kept here for structural parity only).
    if (!products.length) {
      scored = searchProducts(products, query, 0.0);
      productsWithScores = new Map(scored.map(([p, s]) => [p.id, s]));
      products = scored.map(([p]) => p);
    }
  }

  // Step 2: Apply filters
  if (minPrice != null)
    products = products.filter((p) => (p.price ?? 0) >= minPrice!);
  if (maxPrice != null)
    products = products.filter((p) => (p.price ?? 0) <= maxPrice!);
  if (minRating != null)
    products = products.filter((p) => (p.rating ?? 0) >= minRating!);

  // Step 3: Sort (mutate in place)
  if (sortBy === "similarity") {
    if (productsWithScores.size > 0) {
      products.sort(
        (a, b) =>
          (productsWithScores.get(b.id) ?? 0) -
          (productsWithScores.get(a.id) ?? 0),
      );
    } else {
      products.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    }
  } else if (sortBy === "price_asc") {
    products.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  } else if (sortBy === "price_desc") {
    products.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  } else if (sortBy === "rating") {
    products.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }

  return products;
}
