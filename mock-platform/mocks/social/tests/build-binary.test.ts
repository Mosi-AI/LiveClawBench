import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { rmSync, existsSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Binary build verification for the social mock.
// Exercises `bun build --compile` + spawn + health check to ensure the
// compiled binary works end-to-end. Isolated from the 74 in-process
// acceptance tests so a port-allocation flake here doesn't block them.
// ---------------------------------------------------------------------------

const MOCK_ROOT = resolve(import.meta.dir, "..");
const MOCK_PLATFORM_ROOT = resolve(MOCK_ROOT, "../..");
const BINARY_PATH = resolve(MOCK_PLATFORM_ROOT, "dist/mock-social-buildtest");

let serverProcess: any;

function pickPort(): number {
  // Use a wide range derived from PID to minimize collision risk
  return 40000 + (process.pid % 10000);
}

async function waitForHealth(url: string, maxRetries = 50, delayMs = 100): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    if (serverProcess.exitCode !== null && serverProcess.exitCode !== 0) {
      throw new Error(`Server exited with code ${serverProcess.exitCode}`);
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (res.status === 200) return;
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Health check failed after ${maxRetries} retries`);
}

describe("Social Mock: Build Binary", () => {
  beforeAll(async () => {
    // Clean stale DB from previous runs
    for (const p of ["data/social.db", "data/social.db-shm", "data/social.db-wal"]) {
      const full = resolve(MOCK_ROOT, p);
      if (existsSync(full)) rmSync(full);
    }
  });

  afterAll(() => {
    if (serverProcess) {
      try { serverProcess.kill(); } catch {}
    }
    // Clean up binary
    if (existsSync(BINARY_PATH)) {
      try { rmSync(BINARY_PATH); } catch {}
    }
    // Clean up DB
    for (const p of ["data/social.db", "data/social.db-shm", "data/social.db-wal"]) {
      const full = resolve(MOCK_ROOT, p);
      if (existsSync(full)) rmSync(full);
    }
  });

  it("compiles with bun build --compile", async () => {
    const proc = Bun.spawn(
      ["bun", "build", "--compile", "--outfile", BINARY_PATH, "src/index.tsx"],
      { cwd: MOCK_ROOT, stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    expect(exitCode).toBe(0);
    expect(existsSync(BINARY_PATH)).toBe(true);
  });

  it("binary starts and responds to health check", async () => {
    const port = pickPort();
    serverProcess = Bun.spawn(
      [BINARY_PATH, "--port", String(port)],
      { cwd: MOCK_ROOT, stdout: "pipe", stderr: "pipe" },
    );
    await waitForHealth(`http://127.0.0.1:${port}/health`);

    const res = await fetch(`http://127.0.0.1:${port}/__mock_sentinel__/social`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ mock: "social", sentinel: true });
  });

  it("binary exits cleanly on SIGTERM", async () => {
    if (!serverProcess) return;
    serverProcess.kill("SIGTERM");
    const exitCode = await serverProcess.exited;
    // 0 = clean exit, 143 = SIGTERM (128+15) on macOS/Linux
    expect([0, 143].includes(exitCode)).toBe(true);
    serverProcess = null;
  });
}, 60000);
