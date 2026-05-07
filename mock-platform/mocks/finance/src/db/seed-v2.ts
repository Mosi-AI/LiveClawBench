import type { Database } from "bun:sqlite";

function isEmpty(db: Database, table: string): boolean {
  return db.query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table}`).get()!.count === 0;
}

export function seedV2(db: Database): void {
  if (isEmpty(db, "dashboard_config")) {
    db.run(
      `INSERT INTO dashboard_config (user_id, date_range_start, date_range_end, formula_json, department_weight_json)
       VALUES (?, ?, ?, ?, ?)`,
      [1, "2026-01-01", "2026-12-31", "{}", "{}"]
    );
  }

  if (isEmpty(db, "portfolio_holding")) {
    db.run(
      `INSERT INTO portfolio_holding (asset_class_code, asset_name, current_value) VALUES
        ('eq', 'Equities', 100000.0),
        ('fi', 'Fixed Income', 80000.0),
        ('ca', 'Cash', 50000.0),
        ('al', 'Alternatives', 20000.0)`
    );
  }

  if (isEmpty(db, "portfolio_order")) {
    db.run(
      `INSERT INTO portfolio_order (asset_class_code, direction, amount, status) VALUES
        ('eq', 'buy', 5000.0, 'executed'),
        ('fi', 'sell', 3000.0, 'executed'),
        ('al', 'buy', 2000.0, 'submitted')`
    );
  }
}
