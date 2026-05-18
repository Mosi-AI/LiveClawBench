import { z } from "zod";
import { createRoute, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ErrorResponseSchema } from "mock-lib";

const ProviderSchema = z.object({
  id: z.number(),
  name: z.string(),
  district: z.string(),
  distance_km: z.number(),
  network_status: z.string(),
});

const ProviderDetailSchema = ProviderSchema.extend({
  services: z.array(
    z.object({
      id: z.number(),
      check_item: z.string(),
      service_name: z.string(),
      cost: z.number(),
    }),
  ),
});

const SlotSchema = z.object({
  id: z.number(),
  provider_service_id: z.number(),
  start_time: z.string(),
  end_time: z.string(),
  is_available: z.number(),
});

const AppointmentSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  provider_id: z.number(),
  slot_id: z.number(),
  provider_name: z.string(),
  service_name_snapshot: z.string(),
  check_item: z.string(),
  slot_start_time: z.string(),
  slot_end_time: z.string(),
  cost_snapshot: z.number(),
  distance_km_snapshot: z.number(),
  created_at: z.string(),
});

const BookAppointmentBodySchema = z.object({
  slot_id: z.number().int().positive(),
});

const IdParamSchema = z.string().regex(/^\d+$/);

export function registerAppointmentRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/providers
  const listProvidersRoute = createRoute({
    method: "get",
    path: "/api/providers",
    summary: "List providers (public). Query filters: check_item, district, network_status, max_distance, max_price",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ providers: z.array(ProviderDetailSchema) }),
          },
        },
        description: "List of providers with services",
      },
    },
  });

  app.openApiRoute(listProvidersRoute, (c): any => {
    const q = c.req.query();
    const checkItem = q.check_item;
    const district = q.district;
    const networkStatus = q.network_status;
    const maxDistance = q.max_distance ? parseFloat(q.max_distance) : undefined;
    const maxPrice = q.max_price ? parseInt(q.max_price, 10) : undefined;

    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];

    if (district) {
      conditions.push("p.district = ?");
      params.push(district);
    }
    if (networkStatus) {
      conditions.push("p.network_status = ?");
      params.push(networkStatus);
    }
    if (maxDistance !== undefined && !isNaN(maxDistance)) {
      conditions.push("p.distance_km <= ?");
      params.push(maxDistance);
    }

    let providerQuery: string;
    let queryParams: (string | number)[];

    if (checkItem || maxPrice !== undefined) {
      // Filtering by service attributes requires a JOIN + GROUP BY
      const serviceConditions: string[] = [];
      const serviceParams: (string | number)[] = [];
      if (checkItem) {
        serviceConditions.push("ps.check_item = ?");
        serviceParams.push(checkItem);
      }
      if (maxPrice !== undefined && !isNaN(maxPrice)) {
        serviceConditions.push("ps.cost <= ?");
        serviceParams.push(maxPrice);
      }
      providerQuery = `
        SELECT DISTINCT p.id, p.name, p.district, p.distance_km, p.network_status
        FROM provider p
        JOIN provider_service ps ON ps.provider_id = p.id
        WHERE ${conditions.join(" AND ")} AND ${serviceConditions.join(" AND ")}
        ORDER BY p.distance_km
      `;
      queryParams = [...params, ...serviceParams];
    } else {
      providerQuery = `
        SELECT id, name, district, distance_km, network_status
        FROM provider p
        WHERE ${conditions.join(" AND ")}
        ORDER BY distance_km
      `;
      queryParams = params;
    }

    const providerRows = db.query<
      { id: number; name: string; district: string; distance_km: number; network_status: string },
      any
    >(providerQuery).all(...queryParams);

    const providersWithServices = providerRows.map((provider) => {
      const services = db
        .query<{ id: number; check_item: string; service_name: string; cost: number }, [number]>(
          "SELECT id, check_item, service_name, cost FROM provider_service WHERE provider_id = ?",
        )
        .all(provider.id);
      return { ...provider, services };
    });

    return c.json({ providers: providersWithServices });
  });

  // GET /api/providers/:id
  const getProviderRoute = createRoute({
    method: "get",
    path: "/api/providers/{id}",
    summary: "Get provider with services",
    request: {
      params: z.object({ id: IdParamSchema }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ProviderDetailSchema,
          },
        },
        description: "Provider details",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Provider not found",
      },
    },
  });

  app.openApiRoute(getProviderRoute, (c): any => {
    const id = Number(c.req.param("id"));
    const provider = db
      .query<
        { id: number; name: string; district: string; distance_km: number; network_status: string },
        [number]
      >("SELECT id, name, district, distance_km, network_status FROM provider WHERE id = ?")
      .get(id);
    if (!provider) {
      return c.json(err("Provider not found"), 404);
    }

    const services = db
      .query<{ id: number; check_item: string; service_name: string; cost: number }, [number]>(
        "SELECT id, check_item, service_name, cost FROM provider_service WHERE provider_id = ?",
      )
      .all(id);

    return c.json({ ...provider, services });
  });

  // GET /api/providers/:id/services/:service_id/slots
  const listSlotsRoute = createRoute({
    method: "get",
    path: "/api/providers/{id}/services/{service_id}/slots",
    summary: "List available appointment slots for a provider service. Query filters: date_from, date_to",
    request: {
      params: z.object({
        id: IdParamSchema,
        service_id: IdParamSchema,
      }),
      query: z.object({
        date_from: z.string().optional(),
        date_to: z.string().optional(),
      }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ slots: z.array(SlotSchema) }),
          },
        },
        description: "List of available slots",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Provider or service not found",
      },
    },
  });

  app.openApiRoute(listSlotsRoute, (c): any => {
    const providerId = Number(c.req.param("id"));
    const serviceId = Number(c.req.param("service_id"));

    // Verify the service belongs to the provider
    const service = db
      .query<{ id: number }, [number, number]>(
        "SELECT id FROM provider_service WHERE id = ? AND provider_id = ?",
      )
      .get(serviceId, providerId);
    if (!service) {
      return c.json(err("Service not found for this provider"), 404);
    }

    const q = c.req.query();
    const dateFrom = q.date_from;
    const dateTo = q.date_to;

    const conditions: string[] = ["provider_service_id = ?", "is_available = 1"];
    const params: (string | number)[] = [serviceId];

    if (dateFrom) {
      conditions.push("start_time >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push("end_time <= ?");
      params.push(dateTo);
    }

    const slots = db
      .query<
        { id: number; provider_service_id: number; start_time: string; end_time: string; is_available: number },
        any
      >(
        `SELECT id, provider_service_id, start_time, end_time, is_available
         FROM appointment_slot
         WHERE ${conditions.join(" AND ")}
         ORDER BY start_time`,
      )
      .all(...params);
    return c.json({ slots });
  });

  // POST /api/appointments
  const bookAppointmentRoute = createRoute({
    method: "post",
    path: "/api/appointments",
    summary: "Book an appointment (freezes snapshot)",
    request: {
      body: {
        content: {
          "application/json": {
            schema: BookAppointmentBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: AppointmentSchema,
          },
        },
        description: "Appointment booked",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Slot unavailable or invalid",
      },
    },
  });

  app.openApiRoute(bookAppointmentRoute, (c): any => {
    const userId = c.get("userId")!;
    const { slot_id } = c.req.valid("json");

    // Atomic: SELECT slot, UPDATE availability, INSERT appointment
    const book = db.transaction(() => {
      const slot = db
        .query<
          {
            slot_id: number;
            start_time: string;
            end_time: string;
            is_available: number;
            provider_service_id: number;
            check_item: string;
            service_name: string;
            cost: number;
            provider_id: number;
            provider_name: string;
            distance_km: number;
          },
          [number]
        >(
          `SELECT
             s.id AS slot_id,
             s.start_time, s.end_time, s.is_available,
             s.provider_service_id,
             ps.check_item, ps.service_name, ps.cost,
             p.id AS provider_id,
             p.name AS provider_name,
             p.distance_km
           FROM appointment_slot s
           JOIN provider_service ps ON ps.id = s.provider_service_id
           JOIN provider p ON p.id = ps.provider_id
           WHERE s.id = ?`,
        )
        .get(slot_id);

      if (!slot || slot.is_available !== 1) {
        return null;
      }

      db.query("UPDATE appointment_slot SET is_available = 0 WHERE id = ?").run(
        slot_id,
      );

      const insertResult = db.query(
        `INSERT INTO appointment
         (user_id, provider_id, slot_id,
          provider_name, service_name_snapshot, check_item,
          slot_start_time, slot_end_time,
          cost_snapshot, distance_km_snapshot)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        userId,
        slot.provider_id,
        slot.slot_id,
        slot.provider_name,
        slot.service_name,
        slot.check_item,
        slot.start_time,
        slot.end_time,
        slot.cost,
        slot.distance_km,
      );

      return db
        .query<Record<string, unknown>, [number]>(
          "SELECT * FROM appointment WHERE id = ?",
        )
        .get(Number(insertResult.lastInsertRowid));
    });

    const appointment = book();
    if (!appointment) {
      return c.json(err("Slot is not available"), 400);
    }
    return c.json(appointment, 201);
  }, { auth: "required" });

  // GET /api/appointments
  const listAppointmentsRoute = createRoute({
    method: "get",
    path: "/api/appointments",
    summary: "List user appointments",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ appointments: z.array(AppointmentSchema) }),
          },
        },
        description: "List of appointments",
      },
    },
  });

  app.openApiRoute(listAppointmentsRoute, (c): any => {
    const userId = c.get("userId");
    const appointments = db
      .query<Record<string, unknown>, [number]>(
        "SELECT * FROM appointment WHERE user_id = ? ORDER BY slot_start_time DESC",
      )
      .all(userId!);
    return c.json({ appointments });
  }, { auth: "required" });

  // GET /api/appointments/:id
  const getAppointmentRoute = createRoute({
    method: "get",
    path: "/api/appointments/{id}",
    summary: "Get appointment details",
    request: {
      params: z.object({ id: IdParamSchema }),
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: AppointmentSchema,
          },
        },
        description: "Appointment details",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Appointment not found",
      },
    },
  });

  app.openApiRoute(getAppointmentRoute, (c): any => {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));
    const appointment = db
      .query<Record<string, unknown>, [number, number]>(
        "SELECT * FROM appointment WHERE id = ? AND user_id = ?",
      )
      .get(id, userId!);
    if (!appointment) {
      return c.json(err("Appointment not found"), 404);
    }
    return c.json(appointment);
  }, { auth: "required" });
}
