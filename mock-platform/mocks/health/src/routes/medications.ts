import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import {
  MedicationSchema,
  MedicationListQuerySchema,
  CreateMedicationBodySchema,
  UpdateMedicationBodySchema,
  TodayQuerySchema,
  DoseLogSchema,
  CreateDoseLogBodySchema,
  UpdateDoseLogBodySchema,
  DoseLogHistoryQuerySchema,
  PaginationResponseSchema,
  ErrorResponseSchema,
} from "../schemas";
import { errorResponse } from "../utils/errors";
import { validateMedicationInput } from "../services/medication-validator";
import { ValidationError } from "../utils/errors";
import { initDb } from "../db";
import { getToday, getNow } from "../utils/clock";

function getMedicationWithSlots(id: number) {
  const db = initDb();
  const med = db.query("SELECT * FROM medication WHERE id = ? AND user_id = 1").get(id) as any;
  if (!med) return null;
  const slots = db.query("SELECT * FROM medication_intake_slot WHERE medication_id = ?").all(id);
  return { ...med, slots };
}

export function registerMedicationRoutes(app: OpenAPIApp) {
  // GET /api/medications
  const listRoute = createRoute({
    method: "get",
    path: "/api/medications",
    summary: "List medications",
    request: { query: MedicationListQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              medications: z.array(MedicationSchema),
              pagination: PaginationResponseSchema,
            }),
          },
        },
        description: "Medication list",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
    },
  });

  app.openApiRoute(listRoute, (c) => {
    const { page, page_size } = c.req.valid("query");
    const db = initDb();
    const total = (db.query("SELECT COUNT(*) as c FROM medication WHERE user_id = 1 AND archived = 0").get() as any).c;
    const offset = (page - 1) * page_size;
    const meds = db.query(
      "SELECT * FROM medication WHERE user_id = 1 AND archived = 0 ORDER BY id DESC LIMIT ? OFFSET ?"
    ).all(page_size, offset) as any[];
    const medications = meds.map(m => {
      const slots = db.query("SELECT * FROM medication_intake_slot WHERE medication_id = ?").all(m.id);
      return { ...m, slots };
    });
    return c.json({
      medications,
      pagination: { total, total_pages: Math.ceil(total / page_size), current_page: page, page_size },
    });
  });

  // POST /api/medications
  const createMedRoute = createRoute({
    method: "post",
    path: "/api/medications",
    summary: "Create a medication reminder",
    request: {
      body: { content: { "application/json": { schema: CreateMedicationBodySchema } } },
    },
    responses: {
      201: {
        content: { "application/json": { schema: MedicationSchema } },
        description: "Created",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
    },
  });

  app.openApiRoute(createMedRoute, (c) => {
    const body = c.req.valid("json");
    try {
      validateMedicationInput(body);
    } catch (e) {
      if (e instanceof ValidationError) {
        const code = e.details?.code === "UNSUPPORTED_FREQUENCY" ? "UNSUPPORTED_FREQUENCY" : "VALIDATION_ERROR";
        return errorResponse(c, code as any, e.message, e.details);
      }
      throw e;
    }
    const db = initDb();
    const now = getNow();
    const med = db.query(
      "INSERT INTO medication (user_id, name, display_name, frequency, dose_amount, dose_unit, start_date, end_date, notes, created_at, updated_at) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    ).get(body.name, body.display_name ?? null, body.frequency, body.dose_amount ?? null, body.dose_unit ?? null, body.start_date, body.end_date ?? null, body.notes ?? null, now, now) as any;

    const slots = (body.slots ?? []).map(s => {
      return db.query(
        "INSERT INTO medication_intake_slot (medication_id, time_hhmm, dose_amount, dose_unit, label) VALUES (?, ?, ?, ?, ?) RETURNING *"
      ).get(med.id, s.time_hhmm, s.dose_amount ?? null, s.dose_unit ?? null, s.label ?? null);
    });

    return c.json({ ...med, slots }, 201);
  });

  // GET /api/medications/today
  const todayRoute = createRoute({
    method: "get",
    path: "/api/medications/today",
    summary: "Get today's medication schedule",
    request: { query: TodayQuerySchema },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              date: z.string(),
              medications: z.array(MedicationSchema),
            }),
          },
        },
        description: "Today's schedule",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
    },
  });

  app.openApiRoute(todayRoute, (c) => {
    const { date } = c.req.valid("query");
    const targetDate = date || getToday();
    const db = initDb();
    const meds = db.query(
      "SELECT * FROM medication WHERE user_id = 1 AND archived = 0 AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)"
    ).all(targetDate, targetDate) as any[];
    const medications = meds.map(m => {
      const slots = db.query("SELECT * FROM medication_intake_slot WHERE medication_id = ?").all(m.id);
      return { ...m, slots };
    });
    return c.json({ date: targetDate, medications });
  });

  // GET /api/medications/{id}
  const getRoute = createRoute({
    method: "get",
    path: "/api/medications/{id}",
    summary: "Get medication by ID",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: {
        content: { "application/json": { schema: MedicationSchema } },
        description: "Medication detail",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(getRoute, (c) => {
    const { id } = c.req.valid("param");
    const med = getMedicationWithSlots(id);
    if (!med) return errorResponse(c, "NOT_FOUND", `Medication with id ${id} not found`);
    return c.json(med);
  });

  // PUT /api/medications/{id}
  const updateRoute = createRoute({
    method: "put",
    path: "/api/medications/{id}",
    summary: "Update a medication",
    request: {
      params: z.object({ id: z.coerce.number().int() }),
      body: { content: { "application/json": { schema: UpdateMedicationBodySchema } } },
    },
    responses: {
      200: {
        content: { "application/json": { schema: MedicationSchema } },
        description: "Updated",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(updateRoute, (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = initDb();
    const existing = db.query("SELECT * FROM medication WHERE id = ? AND user_id = 1").get(id) as any;
    if (!existing) return errorResponse(c, "NOT_FOUND", `Medication with id ${id} not found`);
    const now = getNow();
    db.query(
      "UPDATE medication SET name = ?, display_name = ?, frequency = ?, dose_amount = ?, dose_unit = ?, start_date = ?, end_date = ?, notes = ?, updated_at = ? WHERE id = ?"
    ).run(
      body.name ?? existing.name,
      body.display_name ?? existing.display_name,
      body.frequency ?? existing.frequency,
      body.dose_amount !== undefined ? body.dose_amount : existing.dose_amount,
      body.dose_unit !== undefined ? body.dose_unit : existing.dose_unit,
      body.start_date ?? existing.start_date,
      body.end_date ?? existing.end_date,
      body.notes ?? existing.notes,
      now, id
    );
    if (body.slots !== undefined) {
      db.query("DELETE FROM medication_intake_slot WHERE medication_id = ?").run(id);
      for (const s of body.slots) {
        db.query(
          "INSERT INTO medication_intake_slot (medication_id, time_hhmm, dose_amount, dose_unit, label) VALUES (?, ?, ?, ?, ?)"
        ).run(id, s.time_hhmm, s.dose_amount ?? null, s.dose_unit ?? null, s.label ?? null);
      }
    }
    return c.json(getMedicationWithSlots(id));
  });

  // DELETE /api/medications/{id}
  const archiveRoute = createRoute({
    method: "delete",
    path: "/api/medications/{id}",
    summary: "Archive a medication",
    request: { params: z.object({ id: z.coerce.number().int() }) },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ success: z.boolean(), archived_at: z.string() }),
          },
        },
        description: "Archived",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(archiveRoute, (c) => {
    const { id } = c.req.valid("param");
    const db = initDb();
    const existing = db.query("SELECT * FROM medication WHERE id = ? AND user_id = 1 AND archived = 0").get(id);
    if (!existing) return errorResponse(c, "NOT_FOUND", `Medication with id ${id} not found`);
    const now = getNow();
    db.query("UPDATE medication SET archived = 1, archived_at = ? WHERE id = ?").run(now, id);
    return c.json({ success: true, archived_at: now });
  });

  // POST /api/medications/{id}/log
  const createLogRoute = createRoute({
    method: "post",
    path: "/api/medications/{id}/log",
    summary: "Log a dose",
    request: {
      params: z.object({ id: z.coerce.number().int() }),
      body: { content: { "application/json": { schema: CreateDoseLogBodySchema } } },
    },
    responses: {
      200: {
        content: { "application/json": { schema: DoseLogSchema } },
        description: "Dose logged",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(createLogRoute, (c) => {
    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    if (body.slot_id && (body.log_dose_amount || body.log_dose_unit)) {
      return errorResponse(c, "VALIDATION_ERROR",
        "slot_id and log_dose fields are mutually exclusive");
    }
    if (!body.slot_id && !body.log_dose_amount) {
      return errorResponse(c, "VALIDATION_ERROR",
        "Either slot_id or log_dose_amount/log_dose_unit is required");
    }
    const db = initDb();
    const med = db.query("SELECT * FROM medication WHERE id = ? AND user_id = 1").get(id);
    if (!med) return errorResponse(c, "NOT_FOUND", `Medication with id ${id} not found`);
    if (body.slot_id) {
      const slot = db.query("SELECT * FROM medication_intake_slot WHERE id = ? AND medication_id = ?").get(body.slot_id, id);
      if (!slot) return errorResponse(c, "NOT_FOUND", `Slot ${body.slot_id} not found for medication ${id}`);
    }
    const now = getNow();
    const log = db.query(
      "INSERT INTO medication_dose_log (medication_id, slot_id, logged_at, status, log_dose_amount, log_dose_unit, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"
    ).get(id, body.slot_id ?? null, body.logged_at ?? now, body.status ?? "taken", body.log_dose_amount ?? null, body.log_dose_unit ?? null, body.notes ?? null, now, now);
    return c.json(log);
  });

  // PUT /api/medications/{id}/log/{logId}
  const updateLogRoute = createRoute({
    method: "put",
    path: "/api/medications/{id}/log/{logId}",
    summary: "Update a dose log",
    request: {
      params: z.object({ id: z.coerce.number().int(), logId: z.coerce.number().int() }),
      body: { content: { "application/json": { schema: UpdateDoseLogBodySchema } } },
    },
    responses: {
      200: {
        content: { "application/json": { schema: DoseLogSchema } },
        description: "Updated",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(updateLogRoute, (c) => {
    const { id, logId } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = initDb();
    const existing = db.query("SELECT * FROM medication_dose_log WHERE id = ? AND medication_id = ?").get(logId, id);
    if (!existing) return errorResponse(c, "NOT_FOUND", `Dose log ${logId} not found`);
    const now = getNow();
    const updated = db.query(
      "UPDATE medication_dose_log SET status = COALESCE(?, status), notes = COALESCE(?, notes), updated_at = ? WHERE id = ? RETURNING *"
    ).get(body.status ?? null, body.notes ?? null, now, logId);
    return c.json(updated);
  });

  // DELETE /api/medications/{id}/log/{logId}
  const deleteLogRoute = createRoute({
    method: "delete",
    path: "/api/medications/{id}/log/{logId}",
    summary: "Delete a dose log",
    request: {
      params: z.object({ id: z.coerce.number().int(), logId: z.coerce.number().int() }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
        description: "Deleted",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(deleteLogRoute, (c) => {
    const { id, logId } = c.req.valid("param");
    const db = initDb();
    const existing = db.query("SELECT * FROM medication_dose_log WHERE id = ? AND medication_id = ?").get(logId, id);
    if (!existing) return errorResponse(c, "NOT_FOUND", `Dose log ${logId} not found`);
    db.query("DELETE FROM medication_dose_log WHERE id = ?").run(logId);
    return c.json({ success: true });
  });

  // GET /api/medications/{id}/logs
  const logsHistoryRoute = createRoute({
    method: "get",
    path: "/api/medications/{id}/logs",
    summary: "Get dose log history",
    request: {
      params: z.object({ id: z.coerce.number().int() }),
      query: DoseLogHistoryQuerySchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              medication_id: z.number(),
              logs: z.array(DoseLogSchema),
              pagination: PaginationResponseSchema,
            }),
          },
        },
        description: "Log history",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Validation error",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(logsHistoryRoute, (c) => {
    const { id } = c.req.valid("param");
    const { start_date, end_date, page, page_size } = c.req.valid("query");
    if (new Date(start_date) > new Date(end_date)) {
      return errorResponse(c, "VALIDATION_ERROR", "start_date must be before end_date");
    }
    const db = initDb();
    const med = db.query("SELECT id FROM medication WHERE id = ? AND user_id = 1").get(id);
    if (!med) return errorResponse(c, "NOT_FOUND", `Medication with id ${id} not found`);
    const total = (db.query(
      "SELECT COUNT(*) as c FROM medication_dose_log WHERE medication_id = ? AND logged_at >= ? AND logged_at <= ?"
    ).get(id, start_date, end_date + "T23:59:59") as any).c;
    const offset = (page - 1) * page_size;
    const logs = db.query(
      "SELECT * FROM medication_dose_log WHERE medication_id = ? AND logged_at >= ? AND logged_at <= ? ORDER BY logged_at DESC LIMIT ? OFFSET ?"
    ).all(id, start_date, end_date + "T23:59:59", page_size, offset);
    return c.json({
      medication_id: id,
      logs,
      pagination: { total, total_pages: Math.ceil(total / page_size), current_page: page, page_size },
    });
  });
}
