import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { createRoute, ok, err } from "mock-lib";
import { z } from "zod";
import {
  TodoResponseSchema,
  TodoListResponseSchema,
  TodoSummaryResponseSchema,
  TodoDeleteResponseSchema,
  ListTodosQuerySchema,
  DateParamSchema,
  MonthParamSchema,
  IdParamSchema,
  CreateTodoBodySchema,
  UpdateTodoBodySchema,
  ErrorResponseSchema,
} from "../schemas";

function rowToTodo(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time,
    location: row.location,
    person: row.person,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function registerTodoRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/todos?start_date=&end_date=&month=
  const listTodosRoute = createRoute({
    method: "get",
    path: "/api/todos",
    summary: "List todos",
    request: { query: ListTodosQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: TodoListResponseSchema } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(listTodosRoute, (c) => {
    const { start_date, end_date, month } = c.req.valid("query");

    try {
      if (month) {
        const [year, monthNum] = month.split("-").map(Number);
        const startDate = `${month}-01`;
        const endDate = monthNum === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;

        const rows = db.query(
          `SELECT * FROM todos WHERE date >= ? AND date < ? ORDER BY date ASC, time ASC, created_at ASC`
        ).all(startDate, endDate) as Record<string, unknown>[];
        return c.json(ok(rows.map(rowToTodo)));
      }

      if (start_date && end_date) {
        const rows = db.query(
          `SELECT * FROM todos WHERE date >= ? AND date <= ? ORDER BY date ASC, time ASC, created_at ASC`
        ).all(start_date, end_date) as Record<string, unknown>[];
        return c.json(ok(rows.map(rowToTodo)));
      }

      const rows = db.query(
        `SELECT * FROM todos ORDER BY date ASC, time ASC, created_at ASC`
      ).all() as Record<string, unknown>[];
      return c.json(ok(rows.map(rowToTodo)));
    } catch (e) {
      return c.json(err(e instanceof Error ? e.message : String(e)), 500);
    }
  });

  // GET /api/todos/:date
  const getTodosByDateRoute = createRoute({
    method: "get",
    path: "/api/todos/{date}",
    summary: "Get todos by date",
    request: { params: DateParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: TodoListResponseSchema } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(getTodosByDateRoute, (c) => {
    const { date } = c.req.valid("param");

    try {
      const rows = db.query(
        `SELECT * FROM todos WHERE date = ? ORDER BY time ASC, created_at ASC`
      ).all(date) as Record<string, unknown>[];
      return c.json(ok(rows.map(rowToTodo)));
    } catch (e) {
      return c.json(err(e instanceof Error ? e.message : String(e)), 500);
    }
  });

  // GET /api/todos/item/:id
  const getTodoByIdRoute = createRoute({
    method: "get",
    path: "/api/todos/item/{id}",
    summary: "Get a single todo",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: TodoResponseSchema } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(getTodoByIdRoute, (c) => {
    const { id } = c.req.valid("param");
    const todoId = parseInt(id, 10);

    try {
      const row = db.query("SELECT * FROM todos WHERE id = ?").get(todoId) as Record<string, unknown> | null;
      if (!row) {
        return c.json(err("Todo not found"), 404);
      }
      return c.json(ok(rowToTodo(row)));
    } catch (e) {
      return c.json(err(e instanceof Error ? e.message : String(e)), 500);
    }
  });

  // POST /api/todos
  const createTodoRoute = createRoute({
    method: "post",
    path: "/api/todos",
    summary: "Create a todo",
    request: { body: { content: { "application/json": { schema: CreateTodoBodySchema } }, description: "Todo data" } },
    responses: {
      201: {
        content: { "application/json": { schema: TodoResponseSchema } },
        description: "Created",
      },
    },
  });

  app.openApiRoute(createTodoRoute, (c) => {
    const data = c.req.valid("json");

    try {
      const { lastInsertRowid: todoId } = db.query(
        `INSERT INTO todos (title, date, time, location, person, description)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        data.title,
        data.date,
        data.time ?? null,
        data.location ?? null,
        data.person ?? null,
        data.description ?? null,
      );

      const row = db.query("SELECT * FROM todos WHERE id = ?").get(Number(todoId)) as Record<string, unknown>;
      return c.json(ok(rowToTodo(row)), 201);
    } catch (e) {
      return c.json(err(e instanceof Error ? e.message : String(e)), 500);
    }
  });

  // PUT /api/todos/:id
  const updateTodoRoute = createRoute({
    method: "put",
    path: "/api/todos/{id}",
    summary: "Update a todo",
    request: {
      params: IdParamSchema,
      body: { content: { "application/json": { schema: UpdateTodoBodySchema } }, description: "Todo updates" },
    },
    responses: {
      200: {
        content: { "application/json": { schema: TodoResponseSchema } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(updateTodoRoute, (c) => {
    const { id } = c.req.valid("param");
    const todoId = parseInt(id, 10);
    const data = c.req.valid("json");

    try {
      const existing = db.query("SELECT * FROM todos WHERE id = ?").get(todoId) as Record<string, unknown> | null;
      if (!existing) {
        return c.json(err("Todo not found"), 404);
      }

      const validFields = ["title", "date", "time", "location", "person", "description"] as const;
      const updates: string[] = [];
      const values: (string | null)[] = [];

      for (const field of validFields) {
        if (field in data) {
          const val = data[field as keyof typeof data];
          updates.push(`${field} = ?`);
          values.push(val === null ? null : String(val).trim());
        }
      }

      if (updates.length === 0) {
        return c.json(ok(rowToTodo(existing)));
      }

      updates.push("updated_at = datetime('now')");
      db.query(`UPDATE todos SET ${updates.join(", ")} WHERE id = ?`).run(...values, todoId);

      const row = db.query("SELECT * FROM todos WHERE id = ?").get(todoId) as Record<string, unknown>;
      return c.json(ok(rowToTodo(row)));
    } catch (e) {
      return c.json(err(e instanceof Error ? e.message : String(e)), 500);
    }
  });

  // DELETE /api/todos/:id
  const deleteTodoRoute = createRoute({
    method: "delete",
    path: "/api/todos/{id}",
    summary: "Delete a todo",
    request: { params: IdParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: TodoDeleteResponseSchema } },
        description: "OK",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not found",
      },
    },
  });

  app.openApiRoute(deleteTodoRoute, (c) => {
    const { id } = c.req.valid("param");
    const todoId = parseInt(id, 10);

    try {
      const result = db.query("DELETE FROM todos WHERE id = ?").run(todoId);
      if (result.changes === 0) {
        return c.json(err("Todo not found"), 404);
      }
      return c.json(ok(undefined, "Todo deleted successfully"));
    } catch (e) {
      return c.json(err(e instanceof Error ? e.message : String(e)), 500);
    }
  });

  // GET /api/summary/:month
  const getSummaryRoute = createRoute({
    method: "get",
    path: "/api/summary/{month}",
    summary: "Get monthly summary",
    request: { params: MonthParamSchema },
    responses: {
      200: {
        content: { "application/json": { schema: TodoSummaryResponseSchema } },
        description: "OK",
      },
    },
  });

  app.openApiRoute(getSummaryRoute, (c) => {
    const { month } = c.req.valid("param");

    try {
      const [year, monthNum] = month.split("-").map(Number);
      const startDate = `${month}-01`;
      const endDate = monthNum === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;

      const rows = db.query(
        `SELECT date, COUNT(*) as count FROM todos WHERE date >= ? AND date < ? GROUP BY date`
      ).all(startDate, endDate) as { date: string; count: number }[];

      const summary: Record<string, number> = {};
      for (const row of rows) {
        summary[row.date] = row.count;
      }
      return c.json(ok(summary));
    } catch (e) {
      return c.json(err(e instanceof Error ? e.message : String(e)), 500);
    }
  });
}
