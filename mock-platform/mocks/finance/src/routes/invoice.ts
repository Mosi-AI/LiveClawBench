import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { InvoiceCreateSchema, InvoiceResponseSchema } from "../schemas/invoice";
import { INVOICE_CATEGORY_CODES } from "../constants";
import { round2 } from "../utils";

export function registerInvoiceRoutes(app: OpenAPIApp, db: Database) {
  const vendorsRoute = createRoute({
    method: "get",
    path: "/api/vendors",
    summary: "List vendors",
    responses: {
      200: { description: "List of vendors" },
    },
  });

  app.openApiRoute(vendorsRoute, (c) => {
    const rows = db.query("SELECT * FROM vendor").all();
    return c.json({ data: rows });
  }, { auth: "required" });

  const createRouteDef = createRoute({
    method: "post",
    path: "/api/invoices",
    summary: "Create invoice",
    request: {
      body: {
        content: {
          "application/json": { schema: InvoiceCreateSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Created",
        content: { "application/json": { schema: InvoiceResponseSchema } },
      },
      400: { description: "Invalid category code" },
    },
  });

  app.openApiRoute(createRouteDef, async (c) => {
    const body = await c.req.json();
    const { vendor_id, invoice_number, invoice_date, items } = body;

    const validCodes = new Set(INVOICE_CATEGORY_CODES.map((c) => c.code));
    for (const item of items) {
      if (!validCodes.has(item.category_code)) {
        return c.json({ error: `Invalid category code: ${item.category_code}` }, 400);
      }
    }

    const vendorRow = db
      .query<{ vendor_name: string }, [number]>("SELECT vendor_name FROM vendor WHERE id = ?")
      .get(vendor_id);
    if (!vendorRow) {
      return c.json({ error: "Vendor not found" }, 400);
    }
    const vendorName = vendorRow.vendor_name;

    const tx = db.transaction(() => {
      const result = db.run(
        "INSERT INTO invoice (vendor_id, vendor_name, invoice_number, invoice_date, status) VALUES (?, ?, ?, ?, 'submitted')",
        [vendor_id, vendorName, invoice_number, invoice_date]
      );
      const invoiceId = result.lastInsertRowid;

      for (const item of items) {
        db.run(
          "INSERT INTO invoice_line_item (invoice_id, description, category_code, amount) VALUES (?, ?, ?, ?)",
          [invoiceId, item.description, item.category_code, round2(item.amount)]
        );
      }
      return invoiceId;
    });

    const invoiceId = tx();
    const row = db
      .query("SELECT * FROM invoice WHERE id = ?")
      .get(Number(invoiceId));
    return c.json(row);
  }, { auth: "required" });
}
