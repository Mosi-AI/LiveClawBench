import { z } from "zod";
import { createRoute, ok, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import {
  ListProductsQuerySchema,
  ListProductsResponseSchema,
  OkSchema,
  ProductSchema,
  ErrSchema,
} from "../schemas.js";
import { filterAndSortProducts, type FilterOptions } from "../search-algorithm.js";
import type { Product } from "../types.js";
const PRODUCTS_PER_PAGE = 30;

export function registerProductRoutes(app: OpenAPIApp, getProducts: () => Product[]) {
  // GET /api/products
  const listProductsRoute = createRoute({
    method: "get",
    path: "/api/products",
    summary: "List products",
    request: {
      query: ListProductsQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ListProductsResponseSchema,
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listProductsRoute, (c) => {
    const { q, sort, page, min_price, max_price, min_rating } = c.req.valid("query");

    const filtered = filterAndSortProducts(getProducts(), {
      query: q,
      minPrice: min_price,
      maxPrice: max_price,
      minRating: min_rating,
      sortBy: sort,
      useSearch: true,
    });
    const totalProducts = filtered.length;
    const totalPgs = Math.ceil(totalProducts / PRODUCTS_PER_PAGE) || 0;
    const startIdx = (page - 1) * PRODUCTS_PER_PAGE;
    const pageProducts = filtered.slice(startIdx, startIdx + PRODUCTS_PER_PAGE);

    return c.json(ok({
      products: pageProducts,
      total_products: totalProducts,
      total_pages: totalPgs,
      current_page: page,
      products_per_page: PRODUCTS_PER_PAGE,
    }));
  });

  // GET /api/product/:product_id
  const getProductRoute = createRoute({
    method: "get",
    path: "/api/product/{product_id}",
    summary: "Get a single product",
    request: {
      params: z.object({ product_id: z.string() }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: OkSchema(ProductSchema),
          },
        },
        description: "OK",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrSchema,
          },
        },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(getProductRoute, (c) => {
    const { product_id } = c.req.valid("param");
    const product = getProducts().find((p) => p.id === product_id);
    if (!product) return c.json(err("Product not found"), 404);
    return c.json(ok(product), 200);
  });
}
