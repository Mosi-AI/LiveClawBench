import { z } from "zod";
import { createRoute, err } from "mock-lib";
import type { OpenAPIApp } from "mock-lib";
import type { Database } from "bun:sqlite";
import { ErrorResponseSchema } from "mock-lib";

const CheckItemEnum = z.enum([
  "general_checkup",
  "dental",
  "vision",
  "lab",
  "imaging",
  "specialist",
]);

const ClaimStatusEnum = z.enum(["submitted", "reviewing", "reimbursed"]);

const ClaimSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  claim_type: z.string(),
  total_amount: z.number(),
  service_date: z.string(),
  provider_name: z.string(),
  check_item: z.string(),
  status: z.string(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const ClaimWithDetailsSchema = ClaimSchema.extend({
  line_items: z.array(
    z.object({
      id: z.number(),
      description: z.string(),
      amount_cents: z.number(),
      created_at: z.string(),
    }),
  ),
  attachments: z.array(
    z.object({
      id: z.number(),
      filename: z.string(),
      file_path: z.string(),
      created_at: z.string(),
    }),
  ),
});

const CreateClaimBodySchema = z.object({
  claim_type: z.string().min(1),
  total_amount: z.number().int().positive(),
  service_date: z.string().min(1),
  provider_name: z.string().min(1),
  check_item: CheckItemEnum,
  notes: z.string().optional(),
});

const UpdateClaimBodySchema = z.object({
  status: ClaimStatusEnum.optional(),
  notes: z.string().optional(),
});

const CreateLineItemBodySchema = z.object({
  description: z.string().min(1),
  amount_cents: z.number().int().positive(),
});

const CreateAttachmentBodySchema = z.object({
  filename: z.string().min(1),
  file_path: z.string().min(1),
});

const IdParamSchema = z.object({
  id: z.string().regex(/^\d+$/),
});

function getClaimById(
  db: Database,
  claimId: number,
  userId: number,
): Record<string, unknown> | null {
  return db
    .query<Record<string, unknown>, [number, number]>(
      "SELECT * FROM claim WHERE id = ? AND user_id = ?",
    )
    .get(claimId, userId);
}

export function registerClaimsRoutes(app: OpenAPIApp, db: Database): void {
  // GET /api/claims
  const listClaimsRoute = createRoute({
    method: "get",
    path: "/api/claims",
    summary: "List claims for current user",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({ claims: z.array(ClaimSchema) }),
          },
        },
        description: "List of claims",
      },
    },
  });

  app.openApiRoute(listClaimsRoute, (c): any => {
    const userId = c.get("userId");
    const claims = db
      .query<Record<string, unknown>, [number]>(
        "SELECT * FROM claim WHERE user_id = ? ORDER BY created_at DESC",
      )
      .all(userId!);
    return c.json({ claims });
  }, { auth: "required" });

  // POST /api/claims
  const createClaimRoute = createRoute({
    method: "post",
    path: "/api/claims",
    summary: "Create a new claim",
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateClaimBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: ClaimSchema,
          },
        },
        description: "Claim created",
      },
      400: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Invalid input",
      },
    },
  });

  app.openApiRoute(createClaimRoute, async (c): Promise<any> => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const insertResult = db.query(
      `INSERT INTO claim
       (user_id, claim_type, total_amount, service_date, provider_name, check_item, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      userId!,
      body.claim_type,
      body.total_amount,
      body.service_date,
      body.provider_name,
      body.check_item,
      "submitted",
      body.notes ?? null,
    );
    const claim = getClaimById(db, Number(insertResult.lastInsertRowid), userId!);
    return c.json(claim, 201);
  }, { auth: "required" });

  // GET /api/claims/{id}
  const getClaimRoute = createRoute({
    method: "get",
    path: "/api/claims/{id}",
    summary: "Get claim details",
    request: {
      params: IdParamSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ClaimWithDetailsSchema,
          },
        },
        description: "Claim details",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Claim not found",
      },
    },
  });

  app.openApiRoute(getClaimRoute, (c): any => {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));
    const claim = getClaimById(db, id, userId!);
    if (!claim) {
      return c.json(err("Claim not found"), 404);
    }

    const lineItems = db
      .query<Record<string, unknown>, [number]>(
        "SELECT id, description, amount_cents, created_at FROM claim_line_item WHERE claim_id = ?",
      )
      .all(id);
    const attachments = db
      .query<Record<string, unknown>, [number]>(
        "SELECT id, filename, file_path, created_at FROM claim_attachment WHERE claim_id = ?",
      )
      .all(id);

    return c.json({ ...claim, line_items: lineItems, attachments });
  }, { auth: "required" });

  // PATCH /api/claims/{id}
  const updateClaimRoute = createRoute({
    method: "patch",
    path: "/api/claims/{id}",
    summary: "Update a claim",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: UpdateClaimBodySchema,
          },
        },
      },
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: ClaimSchema,
          },
        },
        description: "Claim updated",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Claim not found",
      },
    },
  });

  app.openApiRoute(updateClaimRoute, async (c): Promise<any> => {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));
    const claim = getClaimById(db, id, userId!);
    if (!claim) {
      return c.json(err("Claim not found"), 404);
    }

    const body = c.req.valid("json");
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    if (body.status !== undefined) {
      fields.push("status = ?");
      values.push(body.status);
    }
    if (body.notes !== undefined) {
      fields.push("notes = ?");
      values.push(body.notes);
    }

    if (fields.length > 0) {
      db.query(
        `UPDATE claim SET ${fields.join(", ")}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      ).run(...values as [string, ...any[]], id, userId!);
    }

    const updated = getClaimById(db, id, userId!);
    return c.json(updated);
  }, { auth: "required" });

  // POST /api/claims/{id}/line-items
  const createLineItemRoute = createRoute({
    method: "post",
    path: "/api/claims/{id}/line-items",
    summary: "Add a line item to a claim",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateLineItemBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.number(),
              claim_id: z.number(),
              description: z.string(),
              amount_cents: z.number(),
              created_at: z.string(),
            }),
          },
        },
        description: "Line item created",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Claim not found",
      },
    },
  });

  app.openApiRoute(createLineItemRoute, async (c): Promise<any> => {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));
    const claim = getClaimById(db, id, userId!);
    if (!claim) {
      return c.json(err("Claim not found"), 404);
    }

    const body = c.req.valid("json");

    const existingTotal = db
      .query<{ total: number }, [number]>(
        "SELECT COALESCE(SUM(amount_cents), 0) as total FROM claim_line_item WHERE claim_id = ?",
      )
      .get(id);

    const newTotal = (existingTotal?.total ?? 0) + body.amount_cents;
    if (newTotal > (claim.total_amount as number)) {
      return c.json(err("Line item total exceeds claim amount"), 400);
    }

    const insertResult = db.query(
      `INSERT INTO claim_line_item (claim_id, description, amount_cents)
       VALUES (?, ?, ?)`,
    ).run(id, body.description, body.amount_cents);

    const lineItem = db
      .query<Record<string, unknown>, [number]>(
        "SELECT id, claim_id, description, amount_cents, created_at FROM claim_line_item WHERE id = ?",
      )
      .get(Number(insertResult.lastInsertRowid));
    return c.json(lineItem, 201);
  }, { auth: "required" });

  // POST /api/claims/{id}/attachments
  const createAttachmentRoute = createRoute({
    method: "post",
    path: "/api/claims/{id}/attachments",
    summary: "Add an attachment to a claim",
    request: {
      params: IdParamSchema,
      body: {
        content: {
          "application/json": {
            schema: CreateAttachmentBodySchema,
          },
        },
      },
    },
    responses: {
      201: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.number(),
              claim_id: z.number(),
              filename: z.string(),
              file_path: z.string(),
              created_at: z.string(),
            }),
          },
        },
        description: "Attachment created",
      },
      404: {
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
        description: "Claim not found",
      },
    },
  });

  app.openApiRoute(createAttachmentRoute, async (c): Promise<any> => {
    const userId = c.get("userId");
    const id = Number(c.req.param("id"));
    const claim = getClaimById(db, id, userId!);
    if (!claim) {
      return c.json(err("Claim not found"), 404);
    }

    const body = c.req.valid("json");
    const insertResult = db.query(
      `INSERT INTO claim_attachment (claim_id, filename, file_path)
       VALUES (?, ?, ?)`,
    ).run(id, body.filename, body.file_path);

    const attachment = db
      .query<Record<string, unknown>, [number]>(
        "SELECT id, claim_id, filename, file_path, created_at FROM claim_attachment WHERE id = ?",
      )
      .get(Number(insertResult.lastInsertRowid));
    return c.json(attachment, 201);
  }, { auth: "required" });
}
