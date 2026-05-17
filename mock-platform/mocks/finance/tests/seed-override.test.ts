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

  it("MOCK_FINANCE_SEED_SQL override works when file exists", async () => {
    writeFileSync(
      customSeedPath,
      `INSERT INTO user (username, password_hash, role, is_active) VALUES ('custom', 'custom_hash', 'user', 1);`
    );
    process.env.MOCK_FINANCE_SEED_SQL = customSeedPath;
    finance = createFinanceApp();
    app = finance.app;
    await finance.seed!();

    const row = finance.db
      .query<{ username: string }, []>("SELECT username FROM user WHERE username = 'custom'")
      .get();
    expect(row).toBeDefined();
    expect(row!.username).toBe("custom");
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

    expect(warnings.some((w) => w.includes("falling back to default seed"))).toBe(true);
    const row = finance.db
      .query<{ username: string }, []>("SELECT username FROM user WHERE username = 'admin'")
      .get();
    expect(row).toBeDefined();
    expect(row!.username).toBe("admin");
  });
});
