/** @jsxImportSource hono/jsx */
import { createMockApp, createRoute, startServer, authOptional, authRequired } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { runMigrations } from "./db/migrate";
import { seed } from "./db/seed";
import { seedV2 } from "./db/seed-v2";
import { z } from "zod";
import { parseFormBody } from "./utils";

import { registerAuthRoutes } from "./routes/auth";
import { registerDepartmentRoutes } from "./routes/department";
import { registerTransactionRoutes } from "./routes/transaction";
import { registerAccountRoutes } from "./routes/account-balance";
import { registerExpenseRoutes } from "./routes/expense";
import { registerInvoiceRoutes } from "./routes/invoice";
import { registerAssetRoutes } from "./routes/asset";
import { registerSystemConfigRoutes } from "./routes/system-config";
import { registerDashboardRoutes, getEffectiveConfig } from "./routes/dashboard";
import { computeDashboardMetrics } from "./db/queries/dashboard";
import { registerPortfolioRoutes, executePortfolioOrder } from "./routes/portfolio";

import { LoginPage } from "./pages/login";
import { HomePage } from "./pages/home";
import { DepartmentPage } from "./pages/department";
import { TransactionPage } from "./pages/transaction";
import { AccountPage } from "./pages/account";
import { AccountDetailPage } from "./pages/account-detail";
import { ExpenseCreatePage } from "./pages/expense";
import { InvoiceCreatePage } from "./pages/invoice";
import { AssetPage } from "./pages/asset";
import { AssetEditPage } from "./pages/asset-edit";
import { DashboardPage } from "./pages/dashboard";
import { PortfolioPage } from "./pages/portfolio";

function createDbState() {
  const dbPath = process.env.MOCK_FINANCE_DB_PATH
    ?? `${process.env.HOME ?? "/home/node"}/.openclaw/output/finance_app.sqlite`;
  try {
    mkdirSync(dirname(dbPath), { recursive: true });
  } catch {
    // Directory may already exist
  }
  const db = new Database(dbPath, { create: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  return db;
}

export function createFinanceApp() {
  const db = createDbState();

  const mockApp = createMockApp({
    name: "finance",
    port: 1235,
    openApi: {
      enabled: true,
      title: "Finance API",
      version: "1.0.0",
    },
  });

  const { app } = mockApp;

  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/finance",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ ok: z.boolean() }),
          },
        },
        description: "OK",
      },
    },
  });
  app.openApiRoute(sentinelRoute, (c) => c.json({ ok: true }));

  app.use(authOptional);

  app.page("/login", (c) => c.html(<LoginPage />));
  app.page("/", (c) => c.html(<HomePage userId={c.var.userId} />));

  app.use("/departments", authRequired);
  app.page("/departments", (c) => {
    const rows = db.query("SELECT * FROM department_financial_record").all();
    return c.html(<DepartmentPage departments={rows} />);
  });

  app.use("/transactions", authRequired);
  app.page("/transactions", (c) => {
    const rows = db.query("SELECT * FROM transaction_record").all();
    return c.html(<TransactionPage transactions={rows} />);
  });

  app.use("/accounts", authRequired);
  app.page("/accounts", (c) => {
    const rows = db.query("SELECT * FROM account_balance").all();
    return c.html(<AccountPage accounts={rows} />);
  });

  app.use("/accounts/:id", authRequired);
  app.page("/accounts/:id", (c) => {
    const id = Number(c.req.param("id"));
    const account = db.query("SELECT * FROM account_balance WHERE id = ?").get(id);
    if (!account) {
      return c.json({ error: "Not found" }, 404);
    }
    const transactions = db.query("SELECT * FROM account_transaction WHERE account_balance_id = ?").all(id);
    return c.html(<AccountDetailPage account={account} transactions={transactions} />);
  });

  app.use("/expenses/new", authRequired);
  app.page("/expenses/new", (c) => c.html(<ExpenseCreatePage />));

  app.use("/invoices/new", authRequired);
  app.page("/invoices/new", (c) => {
    const vendors = db.query("SELECT * FROM vendor").all();
    return c.html(<InvoiceCreatePage vendors={vendors} />);
  });

  app.use("/assets", authRequired);
  app.page("/assets", (c) => {
    const rows = db.query("SELECT * FROM asset_record").all();
    return c.html(<AssetPage assets={rows} />);
  });

  app.use("/assets/:id/edit", authRequired);
  app.page("/assets/:id/edit", (c) => {
    const id = Number(c.req.param("id"));
    const row = db.query("SELECT * FROM asset_record WHERE id = ?").get(id);
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.html(<AssetEditPage asset={row} />);
  });

  app.use("/dashboard", authRequired);
  app.page("/dashboard", (c) => {
    const userId = c.var.userId as number;
    const user = db.query<{ role: string }, [number]>("SELECT role FROM user WHERE id = ?").get(userId);
    const isAdmin = user?.role === "admin";

    const config = getEffectiveConfig(db, userId);
    const metrics = computeDashboardMetrics(db, config);
    return c.html(<DashboardPage config={config} kpis={metrics.kpis} monthly={metrics.monthly} isAdmin={isAdmin} />);
  });

  function getPortfolioHoldings(): Array<{ asset_class_code: string; asset_name: string; current_value: number }> {
    return db
      .query<{ asset_class_code: string; asset_name: string; current_value: number }, []>(
        "SELECT asset_class_code, asset_name, current_value FROM portfolio_holding ORDER BY asset_class_code"
      )
      .all();
  }

  app.use("/portfolio", authRequired);
  app.page("/portfolio", (c) => {
    const holdings = getPortfolioHoldings();
    const total_value = holdings.reduce((sum, h) => sum + (h.current_value ?? 0), 0);
    const error = c.req.query("error");
    return c.html(<PortfolioPage holdings={holdings} total_value={total_value} error={error} />);
  });
  app.post("/portfolio", async (c) => {
    const body = parseFormBody(await c.req.parseBody());
    const result = executePortfolioOrder(db, body);

    const holdings = getPortfolioHoldings();
    const total_value = holdings.reduce((sum, h) => sum + (h.current_value ?? 0), 0);

    if (!result.success) {
      return c.html(<PortfolioPage holdings={holdings} total_value={total_value} error={result.error} />);
    }
    return c.redirect("/portfolio");
  });

  registerAuthRoutes(app, db);
  registerDepartmentRoutes(app, db);
  registerTransactionRoutes(app, db);
  registerAccountRoutes(app, db);
  registerExpenseRoutes(app, db);
  registerInvoiceRoutes(app, db);
  registerAssetRoutes(app, db);
  registerSystemConfigRoutes(app, db);
  registerDashboardRoutes(app, db);
  registerPortfolioRoutes(app, db);

  return {
    ...mockApp,
    app,
    db,
    seed: async () => {
      runMigrations(db);
      seed(db);
      seedV2(db);
    },
  };
}

if (import.meta.main) {
  const finance = createFinanceApp();
  startServer(finance);
}
