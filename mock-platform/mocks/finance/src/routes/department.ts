import { createRoute } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { DepartmentQuerySchema } from "../schemas/department";

export function registerDepartmentRoutes(app: OpenAPIApp, db: Database) {
  const route = createRoute({
    method: "get",
    path: "/api/departments",
    summary: "List departments",
    request: {
      query: DepartmentQuerySchema,
    },
    responses: {
      200: {
        description: "List of department financial records",
      },
    },
  });

  app.openApiRoute(route, (c) => {
    const month = c.req.query("month");
    const department = c.req.query("department");

    let sql = "SELECT * FROM department_financial_record WHERE 1=1";
    const params: (string | number)[] = [];

    if (month) {
      sql += " AND month = ?";
      params.push(month);
    }
    if (department) {
      sql += " AND department_name = ?";
      params.push(department);
    }

    const rows = db.query(sql).all(...params);
    return c.json({ data: rows });
  }, { auth: "required" });
}
