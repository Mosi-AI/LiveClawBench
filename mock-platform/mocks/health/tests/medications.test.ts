import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { createTestApp, jsonRequest, putRequest, deleteRequest, cleanup } from "./setup";
import { getToday } from "../src/utils/clock";

const DAILY_MED = {
  name: "Aspirin",
  frequency: "daily" as const,
  start_date: "2025-01-01",
  slots: [
    { time_hhmm: "08:00", dose_amount: 100, dose_unit: "mg", label: "Morning" },
    { time_hhmm: "20:00", dose_amount: 100, dose_unit: "mg", label: "Evening" },
  ],
};

const AS_NEEDED_MED = {
  name: "Ibuprofen",
  frequency: "as_needed" as const,
  start_date: "2025-01-01",
};

describe("Medications API", () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp();
  });

  afterEach(() => cleanup());

  // --- Create ---

  test("POST /api/medications creates daily medication with slots", async () => {
    const res = await jsonRequest(app, "/api/medications", DAILY_MED);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Aspirin");
    expect(body.frequency).toBe("daily");
    expect(body.slots.length).toBe(2);
    expect(body.slots[0].time_hhmm).toBe("08:00");
  });

  test("POST /api/medications creates as_needed medication", async () => {
    const res = await jsonRequest(app, "/api/medications", AS_NEEDED_MED);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.frequency).toBe("as_needed");
    expect(body.slots.length).toBe(0);
  });

  test("POST /api/medications accepts weekly frequency", async () => {
    const res = await jsonRequest(app, "/api/medications", {
      name: "Test Weekly",
      frequency: "weekly",
      start_date: "2025-01-01",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.frequency).toBe("weekly");
  });

  test("POST /api/medications rejects invalid frequency", async () => {
    const res = await jsonRequest(app, "/api/medications", {
      name: "Test",
      frequency: "custom",
      start_date: "2025-01-01",
    });
    expect(res.status).toBe(400);
  });

  test("POST /api/medications accepts daily without slots", async () => {
    const res = await jsonRequest(app, "/api/medications", {
      name: "Test No Slots",
      frequency: "daily",
      start_date: "2025-01-01",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slots).toEqual([]);
  });

  test("POST /api/medications accepts daily with empty slots array", async () => {
    const res = await jsonRequest(app, "/api/medications", {
      name: "Test Empty Slots",
      frequency: "daily",
      start_date: "2025-01-01",
      slots: [],
    });
    expect(res.status).toBe(201);
  });

  test("POST /api/medications accepts as_needed with slots", async () => {
    const res = await jsonRequest(app, "/api/medications", {
      ...AS_NEEDED_MED,
      slots: [{ time_hhmm: "08:00", dose_amount: 100, dose_unit: "mg" }],
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slots.length).toBe(1);
  });

  test("POST /api/medications with end_date", async () => {
    const res = await jsonRequest(app, "/api/medications", {
      ...DAILY_MED,
      end_date: "2025-06-01",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.end_date).toBe("2025-06-01");
  });

  // --- List ---

  test("GET /api/medications lists active medications", async () => {
    await jsonRequest(app, "/api/medications", DAILY_MED);
    await jsonRequest(app, "/api/medications", AS_NEEDED_MED);

    const res = await app.request("/api/medications");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.medications.length).toBe(2);
    expect(body.pagination.total).toBe(2);
  });

  test("GET /api/medications with pagination", async () => {
    await jsonRequest(app, "/api/medications", DAILY_MED);
    await jsonRequest(app, "/api/medications", AS_NEEDED_MED);

    const res = await app.request("/api/medications?page=1&page_size=1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.medications.length).toBe(1);
    expect(body.pagination.total).toBe(2);
    expect(body.pagination.total_pages).toBe(2);
  });

  test("GET /api/medications excludes archived", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const { id } = await createRes.json();
    await deleteRequest(app, `/api/medications/${id}`);

    const res = await app.request("/api/medications");
    const body = await res.json();
    expect(body.medications.length).toBe(0);
  });

  // --- Today ---

  test("GET /api/medications/today returns active medications for date", async () => {
    await jsonRequest(app, "/api/medications", DAILY_MED);

    const res = await app.request("/api/medications/today?date=2025-03-01");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe("2025-03-01");
    expect(body.medications.length).toBe(1);
  });

  test("GET /api/medications/today excludes not-yet-started medications", async () => {
    await jsonRequest(app, "/api/medications", {
      ...DAILY_MED,
      start_date: "2025-06-01",
    });

    const res = await app.request("/api/medications/today?date=2025-03-01");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.medications.length).toBe(0);
  });

  test("GET /api/medications/today excludes ended medications", async () => {
    await jsonRequest(app, "/api/medications", {
      ...DAILY_MED,
      end_date: "2025-02-01",
    });

    const res = await app.request("/api/medications/today?date=2025-03-01");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.medications.length).toBe(0);
  });

  test("GET /api/medications/today includes medication with no end_date", async () => {
    await jsonRequest(app, "/api/medications", DAILY_MED);

    const res = await app.request("/api/medications/today?date=2026-12-31");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.medications.length).toBe(1);
  });

  // --- Get by ID ---

  test("GET /api/medications/{id} returns medication with slots", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const { id } = await createRes.json();

    const res = await app.request(`/api/medications/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(id);
    expect(body.slots.length).toBe(2);
  });

  test("GET /api/medications/{id} returns 404 for nonexistent", async () => {
    const res = await app.request("/api/medications/99999");
    expect(res.status).toBe(404);
  });

  // --- Update ---

  test("PUT /api/medications/{id} updates medication", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const { id } = await createRes.json();

    const res = await putRequest(app, `/api/medications/${id}`, {
      name: "Updated Aspirin",
      notes: "Take with food",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated Aspirin");
    expect(body.notes).toBe("Take with food");
  });

  test("PUT /api/medications/{id} replaces slots", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const { id } = await createRes.json();

    const res = await putRequest(app, `/api/medications/${id}`, {
      slots: [{ time_hhmm: "12:00", dose_amount: 200, dose_unit: "mg", label: "Noon" }],
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slots.length).toBe(1);
    expect(body.slots[0].time_hhmm).toBe("12:00");
  });

  test("PUT /api/medications/{id} accepts weekly frequency", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const { id } = await createRes.json();

    const res = await putRequest(app, `/api/medications/${id}`, {
      frequency: "weekly",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.frequency).toBe("weekly");
  });

  test("PUT /api/medications/{id} returns 404 for nonexistent", async () => {
    const res = await putRequest(app, "/api/medications/99999", { name: "Test" });
    expect(res.status).toBe(404);
  });

  // --- Archive ---

  test("DELETE /api/medications/{id} archives medication", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const { id } = await createRes.json();

    const res = await deleteRequest(app, `/api/medications/${id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("DELETE /api/medications/{id} returns 404 for already archived", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const { id } = await createRes.json();
    await deleteRequest(app, `/api/medications/${id}`);

    const res = await deleteRequest(app, `/api/medications/${id}`);
    expect(res.status).toBe(404);
  });

  test("DELETE /api/medications/{id} returns 404 for nonexistent", async () => {
    const res = await deleteRequest(app, "/api/medications/99999");
    expect(res.status).toBe(404);
  });

  // --- Dose Log ---

  test("POST /api/medications/{id}/log logs a dose with slot_id", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const med = await createRes.json();
    const slotId = med.slots[0].id;

    const res = await jsonRequest(app, `/api/medications/${med.id}/log`, {
      slot_id: slotId,
      status: "taken",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slot_id).toBe(slotId);
    expect(body.status).toBe("taken");
  });

  test("POST /api/medications/{id}/log logs a dose with custom amount", async () => {
    const createRes = await jsonRequest(app, "/api/medications", AS_NEEDED_MED);
    const med = await createRes.json();

    const res = await jsonRequest(app, `/api/medications/${med.id}/log`, {
      log_dose_amount: 400,
      log_dose_unit: "mg",
      status: "taken",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.log_dose_amount).toBe(400);
    expect(body.log_dose_unit).toBe("mg");
  });

  test("POST /api/medications/{id}/log rejects slot_id + log_dose together", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const med = await createRes.json();

    const res = await jsonRequest(app, `/api/medications/${med.id}/log`, {
      slot_id: med.slots[0].id,
      log_dose_amount: 100,
      status: "taken",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("mutually exclusive");
  });

  test("POST /api/medications/{id}/log rejects neither slot_id nor log_dose", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const med = await createRes.json();

    const res = await jsonRequest(app, `/api/medications/${med.id}/log`, {
      status: "taken",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("required");
  });

  test("POST /api/medications/{id}/log returns 404 for nonexistent medication", async () => {
    const res = await jsonRequest(app, "/api/medications/99999/log", {
      log_dose_amount: 100,
      log_dose_unit: "mg",
      status: "taken",
    });
    expect(res.status).toBe(404);
  });

  test("POST /api/medications/{id}/log returns 404 for invalid slot_id", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const med = await createRes.json();

    const res = await jsonRequest(app, `/api/medications/${med.id}/log`, {
      slot_id: 99999,
      status: "taken",
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain("Slot");
  });

  test("POST /api/medications/{id}/log logs skipped status", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const med = await createRes.json();

    const res = await jsonRequest(app, `/api/medications/${med.id}/log`, {
      slot_id: med.slots[0].id,
      status: "skipped",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("skipped");
  });

  // --- Update Dose Log ---

  test("PUT /api/medications/{id}/log/{logId} updates log status", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const med = await createRes.json();
    const logRes = await jsonRequest(app, `/api/medications/${med.id}/log`, {
      slot_id: med.slots[0].id,
      status: "taken",
    });
    const log = await logRes.json();

    const res = await putRequest(app, `/api/medications/${med.id}/log/${log.id}`, {
      status: "skipped",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("skipped");
  });

  test("PUT /api/medications/{id}/log/{logId} returns 404 for nonexistent log", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const med = await createRes.json();

    const res = await putRequest(app, `/api/medications/${med.id}/log/99999`, {
      status: "taken",
    });
    expect(res.status).toBe(404);
  });

  // --- Dose Log History ---

  test("GET /api/medications/{id}/logs returns log history", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const med = await createRes.json();
    await jsonRequest(app, `/api/medications/${med.id}/log`, {
      slot_id: med.slots[0].id,
      status: "taken",
    });
    await jsonRequest(app, `/api/medications/${med.id}/log`, {
      slot_id: med.slots[1].id,
      status: "taken",
    });

    const today = getToday();
    const res = await app.request(
      `/api/medications/${med.id}/logs?start_date=${today}&end_date=${today}`
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.medication_id).toBe(med.id);
    expect(body.logs.length).toBe(2);
    expect(body.pagination.total).toBe(2);
  });

  test("GET /api/medications/{id}/logs returns 400 when start > end", async () => {
    const createRes = await jsonRequest(app, "/api/medications", DAILY_MED);
    const med = await createRes.json();

    const res = await app.request(
      `/api/medications/${med.id}/logs?start_date=2025-02-01&end_date=2025-01-01`
    );
    expect(res.status).toBe(400);
  });

  test("GET /api/medications/{id}/logs returns 404 for nonexistent medication", async () => {
    const res = await app.request(
      "/api/medications/99999/logs?start_date=2025-01-01&end_date=2025-01-31"
    );
    expect(res.status).toBe(404);
  });
});
