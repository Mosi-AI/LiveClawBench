import { resetDb, resetInjectionState } from "mock-lib";
import { unlinkSync } from "node:fs";
import { createHealthApp } from "../src/index";

// Health tests use a local "health.db" — clear any MOCK_DATA_DIR leaked by
// other test files (e.g., smarthome) that share the same bun test process.
const _savedMockDataDir = process.env.MOCK_DATA_DIR;
function clearLeakedEnv() { delete process.env.MOCK_DATA_DIR; }
function restoreEnv() { if (_savedMockDataDir) process.env.MOCK_DATA_DIR = _savedMockDataDir; }

function removeDbFiles() {
  for (const f of ["health.db", "health.db-wal", "health.db-shm"]) {
    try { unlinkSync(f); } catch {}
  }
}

export function createTestApp() {
  clearLeakedEnv();
  resetDb();
  resetInjectionState();
  removeDbFiles();
  const mockApp = createHealthApp();
  return mockApp.app;
}

export async function jsonRequest(
  app: ReturnType<typeof createTestApp>,
  path: string,
  body: unknown,
) {
  return app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function putRequest(
  app: ReturnType<typeof createTestApp>,
  path: string,
  body: unknown,
) {
  return app.request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteRequest(
  app: ReturnType<typeof createTestApp>,
  path: string,
) {
  return app.request(path, { method: "DELETE" });
}

export function cleanup() {
  resetDb();
  resetInjectionState();
  removeDbFiles();
  restoreEnv();
}
