/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";

export const HomePage: FC = () => {
  return <Layout title="Mosi Shop">
    <div class="container">
      <h1>Welcome to Mosi Shop</h1>
      <p>Search for products:</p>
      <form action="/search" method="get" class="search-form">
        <input type="text" name="q" placeholder="Search products..." />
        <button type="submit">Search</button>
      </form>
    </div>
  </Layout>;
};
