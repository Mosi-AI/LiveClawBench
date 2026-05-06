import type { Database } from "bun:sqlite";
import { readFileSync, existsSync } from "node:fs";

export function seedV2(db: Database): void {
  const seedPath = process.env.MOCK_FINANCE_SEED_SQL ?? "/opt/mock/data/finance_seed.sql";

  if (existsSync(seedPath)) {
    try {
      const sql = readFileSync(seedPath, "utf-8");
      db.exec(sql);
      return;
    } catch {
      console.warn(`[finance] Seed file not readable at ${seedPath}, falling back to default seed.`);
    }
  } else if (process.env.MOCK_FINANCE_SEED_SQL) {
    console.warn(`[finance] Seed file not found at ${seedPath}, falling back to default seed.`);
  }

  // Dashboard config: 1 row for admin user (id=1)
  if (
    db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM dashboard_config")
      .get()!.count === 0
  ) {
    db.run(
      `INSERT INTO dashboard_config (user_id, date_range_start, date_range_end, formula_json, department_weight_json)
       VALUES (?, ?, ?, ?, ?)`,
      [1, "2026-01-01", "2026-12-31", "{}", "{}"]
    );
  }

  // Portfolio holdings: 4 rows (EQ, FI, CA, AL)
  if (
    db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM portfolio_holding")
      .get()!.count === 0
  ) {
    db.run(
      `INSERT INTO portfolio_holding (asset_class_code, asset_name, current_value) VALUES
        ('eq', 'Equities', 100000.0),
        ('fi', 'Fixed Income', 80000.0),
        ('ca', 'Cash', 50000.0),
        ('al', 'Alternatives', 20000.0)`
    );
  }

  // Portfolio orders: 2-3 example orders
  if (
    db
      .query<{ count: number }, []>("SELECT COUNT(*) AS count FROM portfolio_order")
      .get()!.count === 0
  ) {
    db.run(
      `INSERT INTO portfolio_order (asset_class_code, direction, amount, status) VALUES
        ('eq', 'buy', 5000.0, 'executed'),
        ('fi', 'sell', 3000.0, 'executed'),
        ('al', 'buy', 2000.0, 'submitted')`
    );
  }
}
