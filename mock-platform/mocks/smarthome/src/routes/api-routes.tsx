/** @jsxImportSource hono/jsx */
import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import { z } from "zod";
import {
  assertDb,
  canEditCoffeeDate,
  generatePlanId,
  getBenchmarkDate,
  getBenchmarkTime,
  getCoffeeScheduleForDate,
  isValidIsoDate,
  isValidThermostatMode,
  isValidWorkoutType,
} from "../db";
import type { CalendarEvent, GroceryProduct, InventoryItem } from "../types";

const LegacyErrorSchema = z.object({ error: z.string() });
const DeleteSuccessSchema = z.object({ success: z.literal(true) });
const RoomMetricsSchema = z.object({
  temperature: z.number(),
  humidity: z.number(),
  unit_temp: z.string(),
  noise: z.number().optional(),
  light: z.number().optional(),
  air_quality: z.number().optional(),
});
const ThermostatResponseSchema = z.object({
  mode: z.enum(["comfort", "eco", "off"]),
  temperature: z.number(),
  updated_at: z.string(),
});
const ThermostatRequestSchema = z.object({
  mode: z.any().optional(),
  temperature: z.any().optional(),
});
const CoffeeScheduleReadSchema = z.object({
  date: z.string(),
  has_schedule: z.boolean(),
  start_time: z.string().nullable(),
  status: z.string(),
  beans_grams: z.number().nullable(),
  cancelled: z.boolean(),
  updated_at: z.string().nullable(),
});
const CoffeeScheduleRequestSchema = z.object({
  date: z.any().optional(),
  start_time: z.any().optional(),
  beans_grams: z.any().optional(),
  cancelled: z.any().optional(),
});
const InventoryItemSchema = z.object({
  id: z.number(),
  item_name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  location: z.string(),
  expiry_date: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
});
const InventoryRequestSchema = z.object({
  item_name: z.any().optional(),
  quantity: z.any().optional(),
  unit: z.any().optional(),
  location: z.any().optional(),
  expiry_date: z.any().optional(),
  category: z.any().optional(),
});
const GroceryProductSchema = z.object({
  product_id: z.string(),
  name: z.string(),
  quantity: z.number(),
  unit: z.string(),
  stock_status: z.enum(["sufficient", "insufficient", "unavailable"]),
  substitute_for: z.string().nullable().optional(),
  reference: z.string().nullable().optional(),
});
const GroceryRequestSchema = z.object({
  product_id: z.any().optional(),
  name: z.any().optional(),
  quantity: z.any().optional(),
  unit: z.any().optional(),
  stock_status: z.any().optional(),
  substitute_for: z.any().optional(),
  reference: z.any().optional(),
});
const WearableRecoverySchema = z.object({
  sleep_hours: z.number(),
  sleep_score: z.number(),
  readiness: z.number(),
  resting_heart_rate: z.number(),
});
const WearableRecoveryRequestSchema = z.object({
  sleep_hours: z.number().min(0).max(24),
  sleep_score: z.number().min(0).max(100),
  readiness: z.number().min(0).max(100),
  resting_heart_rate: z.number().min(30).max(200),
});
const CalendarEventSchema = z.object({
  id: z.number(),
  title: z.string(),
  start_time: z.string(),
  event_type: z.string().nullable().optional(),
  workout_type: z.enum(["hiit", "yoga", "walking", "cycling", "strength", "swimming", "rest"]).nullable().optional(),
  status: z.enum(["done", "undone"]),
  updated_at: z.string(),
});
const CalendarUpdateRequestSchema = z.object({
  title: z.any().optional(),
  start_time: z.any().optional(),
  event_type: z.any().optional(),
  workout_type: z.any().optional(),
});
const CalendarCreateRequestSchema = z.object({
  title: z.string().min(1, "title is required"),
  start_time: z.string().min(1, "start_time is required"),
  event_type: z.string().optional(),
  workout_type: z.enum(["hiit", "yoga", "walking", "cycling", "strength", "swimming", "rest"]).optional(),
});
const CalendarStatusUpdateRequestSchema = z.object({
  status: z.enum(["done", "undone"]),
});
const UserConstraintsSchema = z.object({
  calorie_target: z.number(),
  macro_targets: z.string(),
  allergy_constraints: z.string(),
  weekly_budget_limit: z.number(),
});
const RecipeSchema = z.object({
  id: z.number(),
  name: z.string(),
  meal_type: z.enum(["breakfast", "lunch", "dinner"]),
  ingredients: z.string(),
  calories_total: z.number(),
  allergens: z.string().nullable().optional(),
});
const MealPlanRecordSchema = z.object({
  plan_id: z.string(),
  created_at: z.string(),
  plan_data: z.string(),
});
const MealPlanCreateResponseSchema = z.object({
  success: z.literal(true),
  plan_id: z.string(),
  created_at: z.string(),
});
const MealPlanRequestSchema = z.object({
  days: z.any().optional(),
});

const roomMetricsRoute = createRoute({
  method: "get",
  path: "/api/room-metrics",
  tags: ["room-metrics"],
  responses: {
    200: { description: "Current room metrics", content: { "application/json": { schema: RoomMetricsSchema } } },
    503: { description: "Room metrics unavailable", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const thermostatReadRoute = createRoute({
  method: "get",
  path: "/api/thermostat",
  tags: ["thermostat"],
  responses: {
    200: { description: "Current thermostat settings", content: { "application/json": { schema: ThermostatResponseSchema } } },
    404: { description: "Thermostat settings not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const thermostatUpdateRoute = createRoute({
  method: "post",
  path: "/api/thermostat",
  tags: ["thermostat"],
  request: { body: { content: { "application/json": { schema: ThermostatRequestSchema } } } },
  responses: {
    200: { description: "Updated thermostat settings", content: { "application/json": { schema: ThermostatResponseSchema } } },
    400: { description: "Invalid thermostat settings", content: { "application/json": { schema: LegacyErrorSchema } } },
    503: { description: "Thermostat settings unavailable", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const coffeeScheduleReadRoute = createRoute({
  method: "get",
  path: "/api/coffee-schedule",
  tags: ["coffee-schedule"],
  request: { query: z.object({ date: z.string().optional() }) },
  responses: {
    200: { description: "Current coffee schedule", content: { "application/json": { schema: CoffeeScheduleReadSchema } } },
    400: { description: "Invalid coffee date", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const coffeeScheduleUpdateRoute = createRoute({
  method: "post",
  path: "/api/coffee-schedule",
  tags: ["coffee-schedule"],
  request: { body: { content: { "application/json": { schema: CoffeeScheduleRequestSchema } } } },
  responses: {
    200: { description: "Updated or cancelled coffee schedule", content: { "application/json": { schema: CoffeeScheduleReadSchema } } },
    400: { description: "Invalid coffee schedule request", content: { "application/json": { schema: LegacyErrorSchema } } },
    503: { description: "Coffee schedule unavailable", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const inventoryListRoute = createRoute({
  method: "get",
  path: "/api/inventory",
  tags: ["inventory"],
  request: { query: z.object({ location: z.string().optional() }) },
  responses: {
    200: { description: "Inventory items", content: { "application/json": { schema: z.array(InventoryItemSchema) } } },
  },
});
const inventoryCreateRoute = createRoute({
  method: "post",
  path: "/api/inventory",
  tags: ["inventory"],
  request: { body: { content: { "application/json": { schema: InventoryRequestSchema } } } },
  responses: {
    201: { description: "Created inventory item", content: { "application/json": { schema: InventoryItemSchema } } },
    400: { description: "Invalid inventory item", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const inventoryUpdateRoute = createRoute({
  method: "put",
  path: "/api/inventory/{id}",
  tags: ["inventory"],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: InventoryRequestSchema } } },
  },
  responses: {
    200: { description: "Updated inventory item", content: { "application/json": { schema: InventoryItemSchema } } },
    400: { description: "Invalid inventory item update", content: { "application/json": { schema: LegacyErrorSchema } } },
    404: { description: "Inventory item not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const inventoryDeleteRoute = createRoute({
  method: "delete",
  path: "/api/inventory/{id}",
  tags: ["inventory"],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Deleted inventory item", content: { "application/json": { schema: DeleteSuccessSchema } } },
    400: { description: "Invalid inventory item id", content: { "application/json": { schema: LegacyErrorSchema } } },
    404: { description: "Inventory item not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const groceryListRoute = createRoute({
  method: "get",
  path: "/api/grocery/products",
  tags: ["grocery-products"],
  responses: {
    200: { description: "Shopping list products", content: { "application/json": { schema: z.array(GroceryProductSchema) } } },
  },
});
const groceryCreateRoute = createRoute({
  method: "post",
  path: "/api/grocery/products",
  tags: ["grocery-products"],
  request: { body: { content: { "application/json": { schema: GroceryRequestSchema } } } },
  responses: {
    201: { description: "Created shopping list product", content: { "application/json": { schema: GroceryProductSchema } } },
    400: { description: "Invalid shopping list product", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const groceryUpdateRoute = createRoute({
  method: "put",
  path: "/api/grocery/products/{id}",
  tags: ["grocery-products"],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: GroceryRequestSchema } } },
  },
  responses: {
    200: { description: "Updated shopping list product", content: { "application/json": { schema: GroceryProductSchema } } },
    400: { description: "Invalid shopping list product update", content: { "application/json": { schema: LegacyErrorSchema } } },
    404: { description: "Shopping list product not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const groceryDeleteRoute = createRoute({
  method: "delete",
  path: "/api/grocery/products/{id}",
  tags: ["grocery-products"],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Deleted shopping list product", content: { "application/json": { schema: DeleteSuccessSchema } } },
    400: { description: "Invalid shopping list product id", content: { "application/json": { schema: LegacyErrorSchema } } },
    404: { description: "Shopping list product not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const wearableRecoveryRoute = createRoute({
  method: "get",
  path: "/api/wearable-recovery",
  tags: ["wearable-recovery"],
  responses: {
    200: { description: "Wearable recovery data", content: { "application/json": { schema: WearableRecoverySchema } } },
    503: { description: "Wearable data unavailable", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const wearableRecoveryUpdateRoute = createRoute({
  method: "post",
  path: "/api/wearable-recovery",
  tags: ["wearable-recovery"],
  request: { body: { content: { "application/json": { schema: WearableRecoveryRequestSchema } } } },
  responses: {
    200: { description: "Updated wearable recovery data", content: { "application/json": { schema: WearableRecoverySchema } } },
    400: { description: "Invalid wearable recovery data", content: { "application/json": { schema: LegacyErrorSchema } } },
    503: { description: "Wearable data unavailable", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const calendarListRoute = createRoute({
  method: "get",
  path: "/api/calendar",
  tags: ["calendar"],
  responses: {
    200: { description: "Calendar events", content: { "application/json": { schema: z.array(CalendarEventSchema) } } },
  },
});
const calendarReadRoute = createRoute({
  method: "get",
  path: "/api/calendar/{id}",
  tags: ["calendar"],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Calendar event", content: { "application/json": { schema: CalendarEventSchema } } },
    404: { description: "Calendar event not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const calendarUpdateRoute = createRoute({
  method: "put",
  path: "/api/calendar/{id}",
  tags: ["calendar"],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: CalendarUpdateRequestSchema } } },
  },
  responses: {
    200: { description: "Updated calendar event", content: { "application/json": { schema: CalendarEventSchema } } },
    400: { description: "Invalid calendar event update", content: { "application/json": { schema: LegacyErrorSchema } } },
    404: { description: "Calendar event not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const calendarCreateRoute = createRoute({
  method: "post",
  path: "/api/calendar",
  tags: ["calendar"],
  request: { body: { content: { "application/json": { schema: CalendarCreateRequestSchema } } } },
  responses: {
    201: { description: "Created calendar event", content: { "application/json": { schema: CalendarEventSchema } } },
    400: { description: "Invalid calendar event", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const calendarDeleteRoute = createRoute({
  method: "delete",
  path: "/api/calendar/{id}",
  tags: ["calendar"],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: "Deleted calendar event", content: { "application/json": { schema: DeleteSuccessSchema } } },
    404: { description: "Calendar event not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const calendarStatusUpdateRoute = createRoute({
  method: "put",
  path: "/api/calendar/{id}/status",
  tags: ["calendar"],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { "application/json": { schema: CalendarStatusUpdateRequestSchema } } },
  },
  responses: {
    200: { description: "Updated calendar event status", content: { "application/json": { schema: CalendarEventSchema } } },
    400: { description: "Invalid status", content: { "application/json": { schema: LegacyErrorSchema } } },
    404: { description: "Calendar event not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const constraintsRoute = createRoute({
  method: "get",
  path: "/api/constraints",
  tags: ["meal-planning"],
  responses: {
    200: { description: "User meal-planning constraints", content: { "application/json": { schema: UserConstraintsSchema } } },
    404: { description: "Constraints not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const recipesRoute = createRoute({
  method: "get",
  path: "/api/recipes",
  tags: ["meal-planning"],
  responses: {
    200: { description: "Recipes", content: { "application/json": { schema: z.array(RecipeSchema) } } },
  },
});
const mealPlanReadRoute = createRoute({
  method: "get",
  path: "/api/meal-plan",
  tags: ["meal-planning"],
  responses: {
    200: { description: "Current meal plan", content: { "application/json": { schema: MealPlanRecordSchema } } },
    404: { description: "Meal plan not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const mealPlanCreateRoute = createRoute({
  method: "post",
  path: "/api/meal-plan",
  tags: ["meal-planning"],
  request: { body: { content: { "application/json": { schema: MealPlanRequestSchema } } } },
  responses: {
    201: { description: "Created meal plan", content: { "application/json": { schema: MealPlanCreateResponseSchema } } },
    400: { description: "Invalid meal plan", content: { "application/json": { schema: LegacyErrorSchema } } },
    404: { description: "Referenced recipe not found", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});
const mealPlanDeleteRoute = createRoute({
  method: "delete",
  path: "/api/meal-plan",
  tags: ["meal-planning"],
  responses: {
    200: { description: "Deleted latest meal plan", content: { "application/json": { schema: DeleteSuccessSchema } } },
    404: { description: "No meal plan to delete", content: { "application/json": { schema: LegacyErrorSchema } } },
  },
});

export function registerApiRoutes(app: OpenAPIApp): void {
  app.openApiRoute(roomMetricsRoute, (c) => {
    const database = assertDb();
    const metrics = database.query("SELECT temperature, humidity, unit_temp, noise, light, air_quality FROM room_metrics LIMIT 1").get();
    if (!metrics) return c.json({ error: "Room metrics unavailable" }, 503);
    return c.json(metrics);
  });

  app.openApiRoute(thermostatReadRoute, (c) => {
    const database = assertDb();
    const thermostat = database.query("SELECT mode, temperature, updated_at FROM thermostat_settings WHERE id = 1").get();
    if (!thermostat) return c.json({ error: "Thermostat settings not found" }, 404);
    return c.json(thermostat);
  });

  app.openApiRoute(thermostatUpdateRoute, async (c) => {
    let body: { mode?: string; temperature?: number };
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }

    const mode = body.mode?.toLowerCase();
    const temperature = body.temperature;
    if (!mode || !isValidThermostatMode(mode)) return c.json({ error: "Invalid mode. Must be comfort, eco, or off" }, 400);
    if (typeof temperature !== "number" || !Number.isFinite(temperature)) return c.json({ error: "Temperature must be a valid number" }, 400);

    const database = assertDb();
    if (!database.query("SELECT id FROM thermostat_settings WHERE id = 1").get()) {
      return c.json({ error: "Thermostat settings unavailable - required state not initialized" }, 503);
    }

    const now = getBenchmarkTime();
    database.query("UPDATE thermostat_settings SET mode = ?, temperature = ?, updated_at = ? WHERE id = 1").run(mode, temperature, now);
    return c.json({ mode, temperature, updated_at: now });
  });

  app.openApiRoute(coffeeScheduleReadRoute, (c) => {
    const requestedDate = c.req.query("date") || getBenchmarkDate();
    if (!isValidIsoDate(requestedDate)) {
      return c.json({ error: "Invalid date format. Use YYYY-MM-DD format" }, 400);
    }

    const schedule = getCoffeeScheduleForDate(requestedDate);
    return c.json({
      date: schedule.schedule_date,
      has_schedule: schedule.has_schedule,
      start_time: schedule.start_time,
      status: schedule.status,
      beans_grams: schedule.beans_grams,
      cancelled: schedule.cancelled,
      updated_at: schedule.updated_at,
    });
  });

  app.openApiRoute(coffeeScheduleUpdateRoute, async (c) => {
    let body: { date?: string; start_time?: string; beans_grams?: number; cancelled?: boolean };
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }

    const database = assertDb();
    if (!database.query("SELECT id FROM benchmark_clock WHERE id = 1").get()) {
      return c.json({ error: "Coffee schedule unavailable - required state not initialized" }, 503);
    }

    const scheduleDate = body.date || getBenchmarkDate();
    if (!isValidIsoDate(scheduleDate)) {
      return c.json({ error: "Invalid date format. Use YYYY-MM-DD format" }, 400);
    }
    if (!canEditCoffeeDate(scheduleDate)) {
      return c.json({ error: "Cannot modify coffee schedule for past dates" }, 400);
    }

    const now = getBenchmarkTime();
    const existingSchedule = getCoffeeScheduleForDate(scheduleDate);

    if (body.cancelled === true) {
      const startTime = existingSchedule.start_time || "07:00";
      const beansGrams = existingSchedule.beans_grams ?? 20;
      database.query(`
        INSERT INTO coffee_schedule (schedule_date, start_time, beans_grams, cancelled, updated_at)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(schedule_date) DO UPDATE SET
          start_time = excluded.start_time,
          beans_grams = excluded.beans_grams,
          cancelled = 1,
          updated_at = excluded.updated_at
      `).run(scheduleDate, startTime, beansGrams, now);

      const cancelledSchedule = getCoffeeScheduleForDate(scheduleDate);
      return c.json({
        date: cancelledSchedule.schedule_date,
        has_schedule: cancelledSchedule.has_schedule,
        start_time: cancelledSchedule.start_time,
        status: cancelledSchedule.status,
        beans_grams: cancelledSchedule.beans_grams,
        cancelled: cancelledSchedule.cancelled,
        updated_at: cancelledSchedule.updated_at,
      });
    }

    const startTime = body.start_time;
    if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) return c.json({ error: "Invalid start_time format. Use HH:MM format" }, 400);
    const [hour, min] = startTime.split(":").map(Number);
    if (hour < 0 || hour > 23 || min < 0 || min > 59) return c.json({ error: "Invalid time value. Hour must be 0-23, minute must be 0-59" }, 400);
    const beansGrams = body.beans_grams ?? 20;
    if (typeof beansGrams !== "number" || beansGrams < 5 || beansGrams > 100) return c.json({ error: "Beans amount must be between 5g and 100g" }, 400);

    database.query(`
      INSERT INTO coffee_schedule (schedule_date, start_time, beans_grams, cancelled, updated_at)
      VALUES (?, ?, ?, 0, ?)
      ON CONFLICT(schedule_date) DO UPDATE SET
        start_time = excluded.start_time,
        beans_grams = excluded.beans_grams,
        cancelled = 0,
        updated_at = excluded.updated_at
    `).run(scheduleDate, startTime, beansGrams, now);

    const updatedSchedule = getCoffeeScheduleForDate(scheduleDate);
    return c.json({
      date: updatedSchedule.schedule_date,
      has_schedule: updatedSchedule.has_schedule,
      start_time: updatedSchedule.start_time,
      status: updatedSchedule.status,
      beans_grams: updatedSchedule.beans_grams,
      cancelled: updatedSchedule.cancelled,
      updated_at: updatedSchedule.updated_at,
    });
  });

  app.openApiRoute(inventoryListRoute, (c) => {
    const database = assertDb();
    const location = c.req.query("location");
    let query = "SELECT id, item_name, quantity, unit, location, expiry_date, category FROM inventory_item";
    const params: string[] = [];
    if (location) {
      query += " WHERE location = ?";
      params.push(location);
    }
    return c.json(database.query(query).all(...params) as InventoryItem[]);
  });

  app.openApiRoute(inventoryCreateRoute, async (c) => {
    let body: Partial<InventoryItem>;
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
    if (!body.item_name || typeof body.quantity !== "number" || !body.unit || !body.location) {
      return c.json({ error: "Missing required fields: item_name, quantity, unit, location" }, 400);
    }
    const database = assertDb();
    const result = database.query("INSERT INTO inventory_item (item_name, quantity, unit, location, expiry_date, category) VALUES (?, ?, ?, ?, ?, ?)").run(body.item_name, body.quantity, body.unit, body.location, body.expiry_date || null, body.category || null);
    return c.json({
      id: result.lastInsertRowid as number,
      item_name: body.item_name,
      quantity: body.quantity,
      unit: body.unit,
      location: body.location,
      expiry_date: body.expiry_date,
      category: body.category,
    }, 201);
  });

  app.openApiRoute(inventoryUpdateRoute, async (c) => {
    const id = Number(c.req.param("id"));
    if (isNaN(id) || !Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid id: must be a positive integer" }, 400);
    let body: Partial<InventoryItem>;
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
    const database = assertDb();
    if (!database.query("SELECT id FROM inventory_item WHERE id = ?").get(id)) return c.json({ error: "Item not found" }, 404);
    if (body.quantity !== undefined && (typeof body.quantity !== "number" || !Number.isFinite(body.quantity))) return c.json({ error: "Quantity must be a valid number" }, 400);
    if (body.location !== undefined && !["fridge", "pantry"].includes(body.location)) return c.json({ error: "Location must be 'fridge' or 'pantry'" }, 400);
    const now = getBenchmarkTime();
    database.query("UPDATE inventory_item SET item_name = COALESCE(?, item_name), quantity = COALESCE(?, quantity), unit = COALESCE(?, unit), location = COALESCE(?, location), expiry_date = COALESCE(?, expiry_date), category = COALESCE(?, category), updated_at = ? WHERE id = ?").run(body.item_name ?? null, body.quantity ?? null, body.unit ?? null, body.location ?? null, body.expiry_date ?? null, body.category ?? null, now, id);
    return c.json(database.query("SELECT id, item_name, quantity, unit, location, expiry_date, category FROM inventory_item WHERE id = ?").get(id));
  });

  app.openApiRoute(inventoryDeleteRoute, (c) => {
    const id = Number(c.req.param("id"));
    if (isNaN(id) || !Number.isInteger(id) || id <= 0) return c.json({ error: "Invalid id: must be a positive integer" }, 400);
    const database = assertDb();
    if (!database.query("SELECT id FROM inventory_item WHERE id = ?").get(id)) return c.json({ error: "Item not found" }, 404);
    database.query("DELETE FROM inventory_item WHERE id = ?").run(id);
    return c.json({ success: true });
  });

  app.openApiRoute(groceryListRoute, (c) => {
    const database = assertDb();
    return c.json(database.query("SELECT product_id, name, quantity, unit, stock_status, substitute_for, reference FROM grocery_product ORDER BY name").all());
  });

  app.openApiRoute(groceryCreateRoute, async (c) => {
    let body: Partial<GroceryProduct>;
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
    if (!body.name || typeof body.quantity !== "number" || !body.unit || !body.stock_status) return c.json({ error: "Missing required fields: name, quantity, unit, stock_status" }, 400);
    const validStockStatuses = ["sufficient", "insufficient", "unavailable"];
    if (!validStockStatuses.includes(body.stock_status)) return c.json({ error: "Invalid stock_status. Must be sufficient, insufficient, or unavailable" }, 400);
    const database = assertDb();
    const timestamp = getBenchmarkTime().replace(/[-:T]/g, "").substring(0, 14);
    const productId = `PROD${timestamp}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    database.query("INSERT INTO grocery_product (product_id, name, quantity, unit, stock_status, substitute_for, reference) VALUES (?, ?, ?, ?, ?, ?, ?)").run(productId, body.name, body.quantity, body.unit, body.stock_status, body.substitute_for || null, body.reference || null);
    return c.json({
      product_id: productId,
      name: body.name,
      quantity: body.quantity,
      unit: body.unit,
      stock_status: body.stock_status,
      substitute_for: body.substitute_for,
      reference: body.reference,
    }, 201);
  });

  app.openApiRoute(groceryUpdateRoute, async (c) => {
    const idParam = c.req.param("id");
    if (!idParam) return c.json({ error: "Product ID required" }, 400);
    let body: Partial<GroceryProduct>;
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
    const database = assertDb();
    if (!database.query("SELECT product_id FROM grocery_product WHERE product_id = ?").get(idParam)) return c.json({ error: "Product not found" }, 404);
    if (body.quantity !== undefined && (typeof body.quantity !== "number" || !Number.isFinite(body.quantity))) return c.json({ error: "Quantity must be a valid number" }, 400);
    if (body.stock_status !== undefined) {
      const validStockStatuses = ["sufficient", "insufficient", "unavailable"];
      if (!validStockStatuses.includes(body.stock_status)) return c.json({ error: "Invalid stock_status. Must be sufficient, insufficient, or unavailable" }, 400);
    }
    database.query("UPDATE grocery_product SET name = COALESCE(?, name), quantity = COALESCE(?, quantity), unit = COALESCE(?, unit), stock_status = COALESCE(?, stock_status), substitute_for = COALESCE(?, substitute_for), reference = COALESCE(?, reference) WHERE product_id = ?").run(body.name ?? null, body.quantity ?? null, body.unit ?? null, body.stock_status ?? null, body.substitute_for ?? null, body.reference ?? null, idParam);
    return c.json(database.query("SELECT product_id, name, quantity, unit, stock_status, substitute_for, reference FROM grocery_product WHERE product_id = ?").get(idParam));
  });

  app.openApiRoute(groceryDeleteRoute, (c) => {
    const idParam = c.req.param("id");
    if (!idParam) return c.json({ error: "Product ID required" }, 400);
    const database = assertDb();
    if (!database.query("SELECT product_id FROM grocery_product WHERE product_id = ?").get(idParam)) return c.json({ error: "Product not found" }, 404);
    database.query("DELETE FROM grocery_product WHERE product_id = ?").run(idParam);
    return c.json({ success: true });
  });

  app.openApiRoute(wearableRecoveryRoute, (c) => {
    const database = assertDb();
    const data = database.query("SELECT sleep_hours, sleep_score, readiness, resting_heart_rate FROM wearable_recovery_state WHERE id = 1").get();
    if (!data) return c.json({ error: "Wearable data unavailable" }, 503);
    return c.json(data);
  });

  app.openApiRoute(wearableRecoveryUpdateRoute, async (c) => {
    let body: { sleep_hours?: number; sleep_score?: number; readiness?: number; resting_heart_rate?: number };
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
    const { sleep_hours, sleep_score, readiness, resting_heart_rate } = body;
    if (typeof sleep_hours !== "number" || typeof sleep_score !== "number" || typeof readiness !== "number" || typeof resting_heart_rate !== "number") return c.json({ error: "Missing required fields: sleep_hours, sleep_score, readiness, resting_heart_rate" }, 400);
    if (sleep_hours < 0 || sleep_hours > 24) return c.json({ error: "sleep_hours must be between 0 and 24" }, 400);
    if (sleep_score < 0 || sleep_score > 100) return c.json({ error: "sleep_score must be between 0 and 100" }, 400);
    if (readiness < 0 || readiness > 100) return c.json({ error: "readiness must be between 0 and 100" }, 400);
    if (resting_heart_rate < 30 || resting_heart_rate > 200) return c.json({ error: "resting_heart_rate must be between 30 and 200" }, 400);
    const database = assertDb();
    if (!database.query("SELECT id FROM wearable_recovery_state WHERE id = 1").get()) return c.json({ error: "Wearable data unavailable - required state not initialized" }, 503);
    database.query("UPDATE wearable_recovery_state SET sleep_hours = ?, sleep_score = ?, readiness = ?, resting_heart_rate = ? WHERE id = 1").run(sleep_hours, sleep_score, readiness, resting_heart_rate);
    return c.json({ sleep_hours, sleep_score, readiness, resting_heart_rate });
  });

  app.openApiRoute(calendarListRoute, (c) => c.json(assertDb().query("SELECT id, title, start_time, event_type, workout_type, status, updated_at FROM calendar_event ORDER BY start_time").all()));
  app.openApiRoute(calendarReadRoute, (c) => {
    const id = c.req.param("id");
    const event = assertDb().query("SELECT id, title, start_time, event_type, workout_type, status, updated_at FROM calendar_event WHERE id = ?").get(id);
    if (!event) return c.json({ error: "Event not found" }, 404);
    return c.json(event);
  });

  app.openApiRoute(calendarCreateRoute, async (c) => {
    let body: { title?: string; start_time?: string; event_type?: string; workout_type?: string };
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
    if (!body.title || !body.start_time) return c.json({ error: "Missing required fields: title, start_time" }, 400);
    if (body.workout_type !== undefined && body.workout_type !== null && !isValidWorkoutType(body.workout_type)) return c.json({ error: "Invalid workout_type" }, 400);
    const database = assertDb();
    const now = getBenchmarkTime();
    const normalizedWorkoutType = body.workout_type ? body.workout_type.toLowerCase() : null;
    const result = database.query("INSERT INTO calendar_event (title, start_time, event_type, workout_type, status, updated_at) VALUES (?, ?, ?, ?, 'undone', ?)").run(body.title, body.start_time, body.event_type || null, normalizedWorkoutType, now);
    return c.json(database.query("SELECT id, title, start_time, event_type, workout_type, status, updated_at FROM calendar_event WHERE id = ?").get(result.lastInsertRowid), 201);
  });

  app.openApiRoute(calendarUpdateRoute, async (c) => {
    const id = c.req.param("id");
    let body: { title?: string; start_time?: string; event_type?: string; workout_type?: string };
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
    const database = assertDb();
    if (!database.query("SELECT id FROM calendar_event WHERE id = ?").get(id)) return c.json({ error: "Event not found" }, 404);
    if (body.workout_type !== undefined && body.workout_type !== null && !isValidWorkoutType(body.workout_type)) return c.json({ error: "Invalid workout_type" }, 400);
    const normalizedWorkoutType = body.workout_type !== undefined && body.workout_type !== null ? body.workout_type.toLowerCase() : null;
    const now = getBenchmarkTime();
    database.query("UPDATE calendar_event SET title = COALESCE(?, title), start_time = COALESCE(?, start_time), event_type = COALESCE(?, event_type), workout_type = ?, updated_at = ? WHERE id = ?").run(body.title || null, body.start_time || null, body.event_type || null, normalizedWorkoutType, now, id);
    return c.json(database.query("SELECT id, title, start_time, event_type, workout_type, status, updated_at FROM calendar_event WHERE id = ?").get(id));
  });

  app.openApiRoute(calendarDeleteRoute, (c) => {
    const id = c.req.param("id");
    const database = assertDb();
    if (!database.query("SELECT id FROM calendar_event WHERE id = ?").get(id)) return c.json({ error: "Event not found" }, 404);
    database.query("DELETE FROM calendar_event WHERE id = ?").run(id);
    return c.json({ success: true });
  });

  app.openApiRoute(calendarStatusUpdateRoute, async (c) => {
    const id = c.req.param("id");
    let body: { status?: string };
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error("mock-smarthome: ERROR parsing request body:", err);
      return c.json({ error: "Internal server error" }, 500);
    }
    if (!body.status || !["done", "undone"].includes(body.status)) return c.json({ error: "Invalid status. Must be 'done' or 'undone'" }, 400);
    const database = assertDb();
    if (!database.query("SELECT id FROM calendar_event WHERE id = ?").get(id)) return c.json({ error: "Event not found" }, 404);
    const now = getBenchmarkTime();
    database.query("UPDATE calendar_event SET status = ?, updated_at = ? WHERE id = ?").run(body.status, now, id);
    return c.json(database.query("SELECT id, title, start_time, event_type, workout_type, status, updated_at FROM calendar_event WHERE id = ?").get(id));
  });

  app.openApiRoute(constraintsRoute, (c) => {
    const constraints = assertDb().query("SELECT calorie_target, macro_targets, allergy_constraints, weekly_budget_limit FROM user_constraints WHERE id = 1").get();
    if (!constraints) return c.json({ error: "Constraints not found" }, 404);
    return c.json(constraints);
  });

  app.openApiRoute(recipesRoute, (c) => c.json(assertDb().query("SELECT id, name, meal_type, ingredients, calories_total, allergens FROM recipe ORDER BY meal_type, name").all()));

  app.openApiRoute(mealPlanReadRoute, (c) => {
    const plan = assertDb().query("SELECT plan_id, created_at, plan_data FROM meal_plan ORDER BY created_at DESC, id DESC LIMIT 1").get();
    if (!plan) return c.json({ error: "No meal plan found" }, 404);
    return c.json(plan);
  });

  app.openApiRoute(mealPlanCreateRoute, async (c) => {
    let body: { days?: Array<{ date: string; meals: Array<{ meal_type: string; meal_id: number }> }> };
    try {
      body = await c.req.json();
    } catch (err) {
      if (err instanceof SyntaxError) return c.json({ error: "Invalid JSON body" }, 400);
      console.error("mock-smarthome: Unexpected error parsing meal-plan body:", err);
      throw err;
    }
    const days = body.days;
    if (!days || !Array.isArray(days) || days.length < 1) return c.json({ error: "At least 1 day required for meal plan" }, 400);
    const validMealTypes = ["breakfast", "lunch", "dinner"];
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      if (!day.date || typeof day.date !== "string" || !isoDateRegex.test(day.date)) return c.json({ error: `Day ${i + 1}: date must be a valid ISO date string (YYYY-MM-DD)` }, 400);
      const [year, month, date] = day.date.split("-").map(Number);
      if (year < 2000 || year > 2100 || month < 1 || month > 12 || date < 1 || date > 31) return c.json({ error: `Day ${i + 1}: invalid date value` }, 400);
      if (!day.meals || !Array.isArray(day.meals)) return c.json({ error: `Day ${i + 1}: meals must be an array` }, 400);
      for (let j = 0; j < day.meals.length; j++) {
        const meal = day.meals[j];
        if (!meal.meal_type || typeof meal.meal_type !== "string" || !validMealTypes.includes(meal.meal_type)) return c.json({ error: `Day ${i + 1}, meal ${j + 1}: meal_type must be one of breakfast, lunch, dinner` }, 400);
        if (typeof meal.meal_id !== "number" || !Number.isInteger(meal.meal_id)) return c.json({ error: `Day ${i + 1}, meal ${j + 1}: meal_id must be an integer` }, 400);
      }
    }
    const database = assertDb();
    for (const day of days) {
      for (const meal of day.meals) {
        if (!database.query("SELECT id FROM recipe WHERE id = ?").get(meal.meal_id)) return c.json({ error: `Recipe not found: ${meal.meal_id}` }, 404);
      }
    }
    const planId = generatePlanId();
    const now = getBenchmarkTime();
    database.query("INSERT INTO meal_plan (plan_id, created_at, plan_data) VALUES (?, ?, ?)").run(planId, now, JSON.stringify(days));
    return c.json({ success: true, plan_id: planId, created_at: now }, 201);
  });

  app.openApiRoute(mealPlanDeleteRoute, (c) => {
    const result = assertDb().query("DELETE FROM meal_plan WHERE id = (SELECT id FROM meal_plan ORDER BY created_at DESC, id DESC LIMIT 1)").run();
    if (result.changes === 0) return c.json({ error: "No meal plan to delete" }, 404);
    return c.json({ success: true });
  });
}
