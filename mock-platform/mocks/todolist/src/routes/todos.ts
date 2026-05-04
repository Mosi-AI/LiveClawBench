import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

function validateDate(date: string): boolean {
  return DATE_PATTERN.test(date);
}

function validateMonth(month: string): boolean {
  return MONTH_PATTERN.test(month);
}

function validateTime(time: string): boolean {
  return TIME_PATTERN.test(time);
}

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
  // GET /api/todos?start_date=&end_date= OR ?month=
  app.get("/api/todos", (c) => {
    const { start_date, end_date, month } = c.req.query();

    try {
      if (month) {
        if (!validateMonth(month)) {
          return c.json({ error: "Invalid month format. Use YYYY-MM" }, 400);
        }
        const [year, monthNum] = month.split("-").map(Number);
        const startDate = `${month}-01`;
        const endDate = monthNum === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(monthNum + 1).padStart(2, "0")}-01`;

        const rows = db.query(
          `SELECT * FROM todos WHERE date >= ? AND date < ? ORDER BY date ASC, time ASC, created_at ASC`
        ).all(startDate, endDate) as Record<string, unknown>[];
        return c.json(rows.map(rowToTodo));
      }

      if (start_date && end_date) {
        if (!validateDate(start_date) || !validateDate(end_date)) {
          return c.json({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
        }
        const rows = db.query(
          `SELECT * FROM todos WHERE date >= ? AND date <= ? ORDER BY date ASC, time ASC, created_at ASC`
        ).all(start_date, end_date) as Record<string, unknown>[];
        return c.json(rows.map(rowToTodo));
      }

      const rows = db.query(
        `SELECT * FROM todos ORDER BY date ASC, time ASC, created_at ASC`
      ).all() as Record<string, unknown>[];
      return c.json(rows.map(rowToTodo));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  // GET /api/todos/:date
  app.get("/api/todos/:date", (c) => {
    const date = c.req.param("date");
    if (!validateDate(date)) {
      return c.json({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
    }

    try {
      const rows = db.query(
        `SELECT * FROM todos WHERE date = ? ORDER BY time ASC, created_at ASC`
      ).all(date) as Record<string, unknown>[];
      return c.json(rows.map(rowToTodo));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  // GET /api/todos/item/:id
  app.get("/api/todos/item/:id", (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid todo ID" }, 400);
    }

    try {
      const row = db.query("SELECT * FROM todos WHERE id = ?").get(id) as Record<string, unknown> | null;
      if (!row) {
        return c.json({ error: "Todo not found" }, 404);
      }
      return c.json(rowToTodo(row));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  // POST /api/todos
  app.post("/api/todos", async (c) => {
    const data = await c.req.json() as Record<string, unknown>;

    if (!data) {
      return c.json({ error: "No data provided" }, 400);
    }

    const title = String(data.title ?? "").trim();
    const date = String(data.date ?? "");

    if (!title) {
      return c.json({ error: "Title is required" }, 400);
    }
    if (!date || !validateDate(date)) {
      return c.json({ error: "Valid date (YYYY-MM-DD) is required" }, 400);
    }

    const time = data.time ? String(data.time) : null;
    if (time && !validateTime(time)) {
      return c.json({ error: "Invalid time format. Use HH:MM" }, 400);
    }

    try {
      db.query(
        `INSERT INTO todos (title, date, time, location, person, description)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(
        title,
        date,
        time,
        data.location != null ? String(data.location) : null,
        data.person != null ? String(data.person) : null,
        data.description != null ? String(data.description) : null,
      );

      const todoId = Number((db.query("SELECT last_insert_rowid() as id").get() as { id: number }).id);
      const row = db.query("SELECT * FROM todos WHERE id = ?").get(todoId) as Record<string, unknown>;
      return c.json(rowToTodo(row), 201);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  // PUT /api/todos/:id
  app.put("/api/todos/:id", async (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid todo ID" }, 400);
    }

    const data = await c.req.json() as Record<string, unknown>;
    if (!data) {
      return c.json({ error: "No data provided" }, 400);
    }

    if ("date" in data && !validateDate(String(data.date))) {
      return c.json({ error: "Invalid date format. Use YYYY-MM-DD" }, 400);
    }
    if ("time" in data && data.time && !validateTime(String(data.time))) {
      return c.json({ error: "Invalid time format. Use HH:MM" }, 400);
    }
    if ("title" in data && !String(data.title).trim()) {
      return c.json({ error: "Title cannot be empty" }, 400);
    }

    try {
      const existing = db.query("SELECT * FROM todos WHERE id = ?").get(id) as Record<string, unknown> | null;
      if (!existing) {
        return c.json({ error: "Todo not found" }, 404);
      }

      const validFields = ["title", "date", "time", "location", "person", "description"] as const;
      const updates: string[] = [];
      const values: (string | null)[] = [];

      for (const field of validFields) {
        if (field in data) {
          const val = data[field];
          updates.push(`${field} = ?`);
          values.push(val === null ? null : String(val).trim());
        }
      }

      if (updates.length === 0) {
        return c.json(rowToTodo(existing));
      }

      updates.push("updated_at = datetime('now')");
      db.query(`UPDATE todos SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);

      const row = db.query("SELECT * FROM todos WHERE id = ?").get(id) as Record<string, unknown>;
      return c.json(rowToTodo(row));
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  // DELETE /api/todos/:id
  app.delete("/api/todos/:id", (c) => {
    const id = parseInt(c.req.param("id"), 10);
    if (isNaN(id)) {
      return c.json({ error: "Invalid todo ID" }, 400);
    }

    try {
      const result = db.query("DELETE FROM todos WHERE id = ?").run(id);
      if (result.changes === 0) {
        return c.json({ error: "Todo not found" }, 404);
      }
      return c.json({ message: "Todo deleted successfully" });
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });

  // GET /api/summary/:month
  app.get("/api/summary/:month", (c) => {
    const month = c.req.param("month");
    if (!validateMonth(month)) {
      return c.json({ error: "Invalid month format. Use YYYY-MM" }, 400);
    }

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
      return c.json(summary);
    } catch (e) {
      return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
  });
}
