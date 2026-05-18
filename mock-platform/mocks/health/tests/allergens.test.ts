import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createTestApp, jsonRequest, putRequest, deleteRequest, cleanup } from "./setup";

describe("Allergens API", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => cleanup());

  test("POST /api/allergens creates an allergen", async () => {
    const res = await jsonRequest(app, "/api/allergens", {
      name: "Peanuts",
      severity: "severe",
      notes: "Anaphylaxis risk",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Peanuts");
    expect(body.severity).toBe("severe");
    expect(body.id).toBeGreaterThan(0);
  });

  test("POST /api/allergens returns 409 for duplicate name", async () => {
    await jsonRequest(app, "/api/allergens", { name: "Peanuts" });
    const res = await jsonRequest(app, "/api/allergens", { name: "Peanuts" });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("CONFLICT");
  });

  test("POST /api/allergens with empty name returns 400", async () => {
    const res = await jsonRequest(app, "/api/allergens", { name: "" });
    expect(res.status).toBe(400);
  });

  test("GET /api/allergens lists active allergens with pagination", async () => {
    await jsonRequest(app, "/api/allergens", { name: "Peanuts" });
    await jsonRequest(app, "/api/allergens", { name: "Shellfish" });
    await jsonRequest(app, "/api/allergens", { name: "Dairy" });

    const res = await app.request("/api/allergens?page=1&page_size=2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allergens.length).toBe(2);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.total_pages).toBe(2);
    expect(body.pagination.current_page).toBe(1);
  });

  test("GET /api/allergens page 2 returns remaining items", async () => {
    await jsonRequest(app, "/api/allergens", { name: "A" });
    await jsonRequest(app, "/api/allergens", { name: "B" });
    await jsonRequest(app, "/api/allergens", { name: "C" });

    const res = await app.request("/api/allergens?page=2&page_size=2");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allergens.length).toBe(1);
    expect(body.pagination.current_page).toBe(2);
  });

  test("GET /api/allergens excludes archived allergens", async () => {
    const createRes = await jsonRequest(app, "/api/allergens", { name: "Peanuts" });
    const { id } = await createRes.json();
    await deleteRequest(app, `/api/allergens/${id}`);

    const res = await app.request("/api/allergens");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.allergens.length).toBe(0);
  });

  test("GET /api/allergens/{id} returns allergen detail", async () => {
    const createRes = await jsonRequest(app, "/api/allergens", {
      name: "Peanuts",
      severity: "moderate",
    });
    const { id } = await createRes.json();

    const res = await app.request(`/api/allergens/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.name).toBe("Peanuts");
  });

  test("GET /api/allergens/{id} returns 404 for nonexistent", async () => {
    const res = await app.request("/api/allergens/99999");
    expect(res.status).toBe(404);
  });

  test("PUT /api/allergens/{id} updates an allergen", async () => {
    const createRes = await jsonRequest(app, "/api/allergens", { name: "Peanuts" });
    const { id } = await createRes.json();

    const res = await putRequest(app, `/api/allergens/${id}`, {
      name: "Tree Nuts",
      severity: "mild",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Tree Nuts");
    expect(body.severity).toBe("mild");
  });

  test("PUT /api/allergens/{id} returns 409 on name conflict", async () => {
    await jsonRequest(app, "/api/allergens", { name: "Peanuts" });
    const createRes = await jsonRequest(app, "/api/allergens", { name: "Shellfish" });
    const { id } = await createRes.json();

    const res = await putRequest(app, `/api/allergens/${id}`, { name: "Peanuts" });
    expect(res.status).toBe(409);
  });

  test("PUT /api/allergens/{id} returns 404 for nonexistent", async () => {
    const res = await putRequest(app, "/api/allergens/99999", { name: "Test" });
    expect(res.status).toBe(404);
  });

  test("DELETE /api/allergens/{id} soft-deletes an allergen", async () => {
    const createRes = await jsonRequest(app, "/api/allergens", { name: "Peanuts" });
    const { id } = await createRes.json();

    const res = await deleteRequest(app, `/api/allergens/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.archived_at).toBeTruthy();
  });

  test("DELETE /api/allergens/{id} returns 404 for already archived", async () => {
    const createRes = await jsonRequest(app, "/api/allergens", { name: "Peanuts" });
    const { id } = await createRes.json();

    await deleteRequest(app, `/api/allergens/${id}`);
    const res = await deleteRequest(app, `/api/allergens/${id}`);
    expect(res.status).toBe(404);
  });

  test("DELETE /api/allergens/{id} returns 404 for nonexistent", async () => {
    const res = await deleteRequest(app, "/api/allergens/99999");
    expect(res.status).toBe(404);
  });

  test("Archived allergen can be retrieved by ID but not in list", async () => {
    const createRes = await jsonRequest(app, "/api/allergens", { name: "Peanuts" });
    const { id } = await createRes.json();
    await deleteRequest(app, `/api/allergens/${id}`);

    const getRes = await app.request(`/api/allergens/${id}`);
    expect(getRes.status).toBe(200);
    const detail = await getRes.json();
    expect(detail.archived).toBe(1);

    const listRes = await app.request("/api/allergens");
    const list = await listRes.json();
    expect(list.allergens.length).toBe(0);
  });

  test("Creating allergen with same name as archived one succeeds", async () => {
    const createRes = await jsonRequest(app, "/api/allergens", { name: "Peanuts" });
    const { id } = await createRes.json();
    await deleteRequest(app, `/api/allergens/${id}`);

    const res = await jsonRequest(app, "/api/allergens", { name: "Peanuts" });
    expect(res.status).toBe(201);
  });
});
