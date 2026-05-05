import type { OpenAPIApp } from "mock-lib";

export async function login(app: OpenAPIApp): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" }),
  });
  return res.headers.get("set-cookie") ?? "";
}
