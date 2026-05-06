/** @jsxImportSource hono/jsx */
import type { FC, Child } from "hono/jsx";
import { Layout } from "./layout.js";
import type { Product } from "../types.js";

function escJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");
}

const ProductCard: FC<{ product: Product }> = ({ product: p }) => {
  const rating = p.rating ?? 0;
  const fullStars = Math.floor(rating);
  const remainingStars = Math.max(0, 5 - fullStars);
  const stars: Child[] = [];
  for (let i = 0; i < fullStars; i++) stars.push(<span class="star full">&#9733;</span>);
  for (let i = 0; i < remainingStars; i++) stars.push(<span class="star empty">&#9734;</span>);

  const tags: Child[] = [];
  if (p.sponsored) tags.push(<span class="tag sponsored">Sponsored</span>);
  if (p.best_seller) tags.push(<span class="tag best-seller">Best Seller</span>);
  if (p.overall_pick) tags.push(<span class="tag overall-pick">Overall Pick</span>);
  if (p.limited_time) tags.push(<span class="tag limited-time">Limited Time</span>);
  if (p.discounted) tags.push(<span class="tag discounted">Discounted</span>);
  if (p.low_stock) tags.push(<span class="tag low-stock">Low Stock</span>);

  return <div class="product-card">
    <div class="product-image"><img src={p.image_url} alt={p.title} /></div>
    <div class="product-info">
      <h3 class="product-title">{p.title}</h3>
      <div class="product-rating">
        <span class="stars">{stars}</span>{" "}
        <span class="rating-text">{rating.toFixed(1)}</span>
        {p.rating_count ? ` (${p.rating_count})` : ""}
      </div>
      <div class="product-price">{`$${p.price.toFixed(2)}`}</div>
      {tags.length > 0 ? <div class="product-tags">{tags}</div> : null}
      <button class="add-to-cart-btn" onclick={`addToCart('${escJs(p.id)}')`}>Add to Cart</button>
    </div>
  </div>;
};

export const SORT_LABELS: Record<string, string> = {
  similarity: "Relevance",
  price_asc: "Price: Low to High",
  price_desc: "Price: High to Low",
  rating: "Rating",
};

export const ResultsPage: FC<{
  query: string;
  products: Product[];
  currentSort: string;
  currentPage: number;
  totalPages: number;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
}> = ({ query, products, currentSort, currentPage, totalPages, minPrice, maxPrice, minRating }) => {
  const sortOptions: Child[] = ["similarity", "price_asc", "price_desc", "rating"].map((s) =>
    <option value={s} selected={s === currentSort}>{SORT_LABELS[s]}</option>
  );

  const pagination: Child[] = [];
  if (totalPages > 1) {
    for (let p = 1; p <= totalPages; p++) {
      if (p === currentPage) {
        pagination.push(<span class="page current">{p}</span>);
      } else {
        const params = new URLSearchParams({ q: query, sort: currentSort, page: String(p) });
        if (minPrice != null) params.set("min_price", String(minPrice));
        if (maxPrice != null) params.set("max_price", String(maxPrice));
        if (minRating != null) params.set("min_rating", String(minRating));
        pagination.push(<a href={`/search?${params}`} class="page">{p}</a>);
      }
    }
  }

  return <Layout title={`Search: ${query}`} scripts={`
async function addToCart(productId) {
  try {
    const response = await fetch('/api/cart/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId })
    });
    const data = await response.json();
    if (data.success) {
      const el = document.getElementById('cart-count');
      if (el) el.textContent = data.cart_count;
    } else {
      alert('Failed to add item to cart');
    }
  } catch (error) {
    console.error('Error adding to cart:', error);
    alert('Error adding item to cart');
  }
}`}>
    <div class="container">
      <h1>Search Results</h1>
      <p class="meta">Query: <code>{query}</code></p>
      <form action="/search" method="get" class="search-form">
        <input type="text" name="q" value={query} />
        <select name="sort">{sortOptions}</select>
        <input type="number" name="min_price" placeholder="Min price" step="0.01" value={minPrice ?? ""} />
        <input type="number" name="max_price" placeholder="Max price" step="0.01" value={maxPrice ?? ""} />
        <input type="number" name="min_rating" placeholder="Min rating" step="0.1" min="0" max="5" value={minRating ?? ""} />
        <button type="submit">Search</button>
      </form>
      {products.length > 0
        ? <div class="product-list">{products.map((p) => <ProductCard product={p} />)}</div>
        : <p>No products found matching your search.</p>
      }
      {pagination.length > 0 ? <div class="pagination">{pagination}</div> : null}
    </div>
  </Layout>;
};
