-- Seed for finance-dashboard-repair: inject broken dashboard_config with deprecated field names.
-- Runs AFTER default seed and seedV2, which inserts a default dashboard_config for user_id=1.
-- We replace the default config with our broken one.

INSERT OR REPLACE INTO dashboard_config (user_id, date_range_start, date_range_end, formula_json, department_weight_json)
VALUES (
  1,
  '2026-01-01',
  '2026-12-31',
  '{"op":"add","left":{"op":"subtract","left":{"op":"field","name":"revenue_amount"},"right":{"op":"multiply","left":{"op":"field","name":"total_expenses"},"right":{"op":"const","value":0.10}}},"right":{"op":"multiply","left":{"op":"subtract","left":{"op":"field","name":"budget_deviation"},"right":{"op":"field","name":"total_expenses"}},"right":{"op":"const","value":0.05}}}',
  '{"Engineering":1.0,"Sales":1.2,"Marketing":0.8}'
);
