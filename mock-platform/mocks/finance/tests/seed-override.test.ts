import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { _resetSecret } from "mock-lib";
import { createFinanceApp } from "../src/index";
import { writeFileSync, unlinkSync } from "node:fs";

describe("seed override", () => {
  let app: ReturnType<typeof createFinanceApp>["app"];
  let finance: ReturnType<typeof createFinanceApp>;
  const customSeedPath = "/tmp/finance_custom_seed.sql";

  beforeEach(async () => {
    process.env.MOCK_FINANCE_DB_PATH = ":memory:";
    _resetSecret();
  });

  afterEach(() => {
    delete process.env.MOCK_FINANCE_DB_PATH;
    delete process.env.MOCK_FINANCE_SEED_SQL;
    try {
      unlinkSync(customSeedPath);
    } catch {
      // ignore
    }
  });

  it("MOCK_FINANCE_SEED_SQL supplements baseline fixtures", async () => {
    writeFileSync(
      customSeedPath,
      `INSERT INTO user (username, password_hash, role, is_active) VALUES ('custom', 'custom_hash', 'user', 1);`
    );
    process.env.MOCK_FINANCE_SEED_SQL = customSeedPath;
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();

    // Custom user exists
    const customRow = finance.db
      .query<{ username: string }, []>("SELECT username FROM user WHERE username = 'custom'")
      .get();
    expect(customRow).toBeDefined();
    expect(customRow!.username).toBe("custom");

    // Default user also still exists (supplement, not replace)
    const defaultRow = finance.db
      .query<{ username: string }, []>("SELECT username FROM user WHERE username = 'admin'")
      .get();
    expect(defaultRow).toBeDefined();
    expect(defaultRow!.username).toBe("admin");
  });

  it("unset env uses default seed", async () => {
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();

    const row = finance.db
      .query<{ username: string }, []>("SELECT username FROM user WHERE username = 'admin'")
      .get();
    expect(row).toBeDefined();
    expect(row!.username).toBe("admin");
  });

  it("custom seed can DELETE+re-INSERT tables with FK children", async () => {
    // Reproduces the finance-anomaly-detect pattern: seedDefaults creates
    // account_transaction rows referencing transaction_record, then the
    // custom seed does DELETE FROM transaction_record + INSERT.
    // Without PRAGMA foreign_keys = OFF during custom seed, the DELETE
    // would fail with FK constraint violation and IDs would shift.
    writeFileSync(
      customSeedPath,
      [
        "DELETE FROM account_transaction;",
        "DELETE FROM transaction_record;",
        "DELETE FROM sqlite_sequence WHERE name = 'transaction_record';",
        "INSERT INTO transaction_record (trade_date, vendor_name, amount, category, status, approval_status, approval_note)",
        "  VALUES ('2026-03-01', 'TestVendor', 9999.0, 'software', 'pending', 'pending', '');",
      ].join("\n")
    );
    process.env.MOCK_FINANCE_SEED_SQL = customSeedPath;
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();

    // The custom transaction should start at id=1 (not id=11+)
    const row = finance.db
      .query<{ id: number; vendor_name: string }, []>(
        "SELECT id, vendor_name FROM transaction_record WHERE vendor_name = 'TestVendor'"
      )
      .get();
    expect(row).toBeDefined();
    expect(row!.id).toBe(1);
    expect(row!.vendor_name).toBe("TestVendor");

    // Only 1 transaction (defaults were deleted)
    const count = finance.db
      .query<{ cnt: number }, []>("SELECT COUNT(*) AS cnt FROM transaction_record")
      .get()!;
    expect(count.cnt).toBe(1);

    // Default users still exist (seedDefaults ran first)
    const adminRow = finance.db
      .query<{ username: string }, []>("SELECT username FROM user WHERE username = 'admin'")
      .get();
    expect(adminRow).toBeDefined();
  });

  it("missing file triggers warning + fallback", async () => {
    process.env.MOCK_FINANCE_SEED_SQL = "/tmp/nonexistent_finance_seed.sql";
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };

    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();

    console.warn = originalWarn;

    expect(warnings.some((w) => w.includes("Custom seed file not found"))).toBe(true);
    const row = finance.db
      .query<{ username: string }, []>("SELECT username FROM user WHERE username = 'admin'")
      .get();
    expect(row).toBeDefined();
    expect(row!.username).toBe("admin");
  });
});
