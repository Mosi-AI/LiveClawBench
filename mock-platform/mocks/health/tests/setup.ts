import { resetDb } from "mock-lib";
import { unlinkSync } from "node:fs";
import { createHealthApp } from "../src/index";

function removeDbFiles() {
  for (const f of ["health.db", "health.db-wal", "health.db-shm"]) {
    try { unlinkSync(f); } catch {}
  }
}

export function createTestApp() {
  resetDb();
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
  removeDbFiles();
}
