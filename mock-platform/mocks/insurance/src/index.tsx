/** @jsxImportSource hono/jsx */
import { z } from "zod";
import bcryptjs from "bcryptjs";
import {
  createMockApp,
  createRoute,
  startServer,
  verify,
  sign,
  tokenCookieOptions,
  registerStaticAssets,
} from "mock-lib";
import type { MockAppV2, AppEnv } from "mock-lib";
import type { Context, Next } from "hono";
import { getInsuranceDb } from "./db";
import { seedDatabase } from "./seed";
import { registerAuthRoutes, getUserByEmail, serializeCookie } from "./routes/auth";
import { registerClaimsRoutes } from "./routes/claims";
import { registerAppointmentRoutes } from "./routes/appointments";
import { registerPlansRoutes } from "./routes/plans";
import { LoginPage } from "./components/login-page";
import { Layout } from "./components/layout";
import { ClaimsListPage } from "./components/claims-list-page";
import { ClaimsNewPage } from "./components/claims-new-page";
import { ClaimDetailPage } from "./components/claim-detail-page";
import { AppointmentsSearchPage } from "./components/appointments-search-page";
import { ProviderDetailPage } from "./components/provider-detail-page";
import { PlansListPage } from "./components/plans-list-page";
import { PlansCurrentPage } from "./components/plans-current-page";
import { PlansSelectPage } from "./components/plans-select-page";

/**
 * Page-auth middleware: cookie-first, Bearer fallback, redirect on failure.
 * Sets c.var.userId when authentication succeeds.
 */
export async function pageAuthRequired(c: Context<AppEnv>, next: Next) {
  let token: string | null = null;

  // 1. Cookie-first extraction
  const cookie = c.req.header("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)token=([^;]*)/);
  if (match) token = match[1];

  // 2. Bearer fallback
  if (!token) {
    const auth = c.req.header("Authorization");
    if (auth?.startsWith("Bearer ")) {
      token = auth.slice(7);
    }
  }

  if (!token) {
    return c.redirect(`/login?next=${encodeURIComponent(c.req.path)}`);
  }

  const payload = await verify(token);
  if (!payload) {
    return c.redirect(`/login?next=${encodeURIComponent(c.req.path)}`);
  }

  c.set("userId", payload.userId as number | undefined);
  await next();
}

export function createInsuranceApp(): MockAppV2 {
  const mockApp = createMockApp({
    name: "insurance",
    port: 6000,
    openApi: {
      enabled: true,
      title: "Insurance Mock API",
      version: "1.0.0",
    },
  });
  const { app } = mockApp;
  const db = getInsuranceDb();

  // Sentinel route for isolation verification.
  const sentinelRoute = createRoute({
    method: "get",
    path: "/__mock_sentinel__/insurance",
    summary: "Binary isolation probe",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              ok: z.boolean(),
              mock: z.literal("insurance"),
            }),
          },
        },
        description: "OK",
      },
    },
  });

  app.openApiRoute(sentinelRoute, (c) =>
    c.json({ ok: true, mock: "insurance" as const }),
  );

  // API routes
  registerAuthRoutes(app, db);
  registerClaimsRoutes(app, db);
  registerAppointmentRoutes(app, db);
  registerPlansRoutes(app, db);

  // Static assets
  registerStaticAssets(app, {
    dir: "/opt/mock/static/insurance",
    prefix: "/static",
  });

  // Root redirect to login
  app.page("/", (c) => {
    return c.redirect("/login");
  });

  // SSR login page (GET)
  app.page("/login", (c) => {
    const next = c.req.query("next") ?? "/claims";
    return c.html(<LoginPage next={next} />);
  });

  // SSR login form handler (POST)
  app.post("/login", async (c) => {
    const body = await c.req.parseBody();
    const email = String(body.email ?? "");
    const password = String(body.password ?? "");
    const next = String(body.next ?? "/claims");

    const user = getUserByEmail(db, email);
    if (!user || !bcryptjs.compareSync(password, user.password_hash)) {
      return c.html(
        <LoginPage
          error="Invalid email or password"
          next={next}
        />,
        200,
      );
    }

    const token = await sign({ userId: user.id });
    const cookieStr = serializeCookie("token", token, tokenCookieOptions());
    c.header("Set-Cookie", cookieStr);
    return c.redirect(next);
  });

  // Helper to fetch current user for page rendering
  function getCurrentUser(
    database: typeof db,
    userId: number,
  ): {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  } {
    return database
      .query<
        {
          id: number;
          email: string;
          first_name: string;
          last_name: string;
          phone: string | null;
        },
        [number]
      >("SELECT id, email, first_name, last_name, phone FROM users WHERE id = ?")
      .get(userId)!;
  }

  // --- Claims pages ---
  app.use("/claims", pageAuthRequired);
  app.page("/claims", (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);
    const claims = db
      .query<Record<string, unknown>, [number]>(
        "SELECT * FROM claim WHERE user_id = ? ORDER BY created_at DESC",
      )
      .all(userId);
    return c.html(<ClaimsListPage user={user} claims={claims as any} />);
  });

  app.use("/claims/new", pageAuthRequired);
  app.page("/claims/new", (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);
    return c.html(<ClaimsNewPage user={user} />);
  });
  app.post("/claims/new", pageAuthRequired, async (c) => {
    const userId = c.get("userId")!;
    const body = await c.req.parseBody();
    const claim_type = String(body.claim_type ?? "");
    const total_amount = parseInt(String(body.total_amount ?? "0"), 10);
    const service_date = String(body.service_date ?? "");
    const provider_name = String(body.provider_name ?? "");
    const check_item = String(body.check_item ?? "");
    const notes = String(body.notes ?? "");

    db.query(
      `INSERT INTO claim (user_id, claim_type, total_amount, service_date, provider_name, check_item, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'submitted', ?)`,
    ).run(userId, claim_type, total_amount, service_date, provider_name, check_item, notes);

    const row = db.query<{ id: number }, []>("SELECT last_insert_rowid() AS id").get();
    return c.redirect(`/claims/${row!.id}`);
  });

  app.use("/claims/:id", pageAuthRequired);
  app.page("/claims/:id", (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);
    const id = Number(c.req.param("id"));
    const claim = db
      .query<Record<string, unknown>, [number, number]>(
        "SELECT * FROM claim WHERE id = ? AND user_id = ?",
      )
      .get(id, userId);
    if (!claim) return c.notFound();

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

    return c.html(
      <ClaimDetailPage
        user={user}
        claim={claim as any}
        line_items={lineItems as any}
        attachments={attachments as any}
      />,
    );
  });

  // --- Appointments pages ---
  app.use("/appointments/search", pageAuthRequired);
  app.page("/appointments/search", (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);

    // Parse query filters (same logic as the public API)
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

    const providers = db
      .query<
        {
          id: number;
          name: string;
          district: string;
          distance_km: number;
          network_status: string;
        },
        any
      >(providerQuery)
      .all(...queryParams);

    return c.html(
      <AppointmentsSearchPage
        user={user}
        providers={providers}
        filters={{
          check_item: checkItem ?? "",
          district: district ?? "",
          network_status: networkStatus ?? "",
          max_distance: q.max_distance ?? "",
          max_price: q.max_price ?? "",
        }}
      />,
    );
  });

  app.use("/appointments/providers/:id", pageAuthRequired);
  app.page("/appointments/providers/:id", (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);
    const id = Number(c.req.param("id"));
    const provider = db
      .query<
        {
          id: number;
          name: string;
          district: string;
          distance_km: number;
          network_status: string;
        },
        [number]
      >(
        "SELECT id, name, district, distance_km, network_status FROM provider WHERE id = ?",
      )
      .get(id);
    if (!provider) return c.notFound();

    const services = db
      .query<
        { id: number; check_item: string; service_name: string; cost: number },
        [number]
      >(
        "SELECT id, check_item, service_name, cost FROM provider_service WHERE provider_id = ?",
      )
      .all(id);

    const slotsByService: Record<
      number,
      Array<{ id: number; start_time: string; end_time: string }>
    > = {};
    for (const svc of services) {
      const slots = db
        .query<
          { id: number; start_time: string; end_time: string },
          [number]
        >(
          `SELECT id, start_time, end_time FROM appointment_slot
           WHERE provider_service_id = ? AND is_available = 1
           ORDER BY start_time`,
        )
        .all(svc.id);
      slotsByService[svc.id] = slots;
    }

    return c.html(
      <ProviderDetailPage
        user={user}
        provider={provider}
        services={services}
        slotsByService={slotsByService}
      />,
    );
  });

  app.post("/appointments/book", pageAuthRequired, async (c) => {
    const userId = c.get("userId")!;
    const body = await c.req.parseBody();
    const slot_id = parseInt(String(body.slot_id ?? "0"), 10);

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
        `SELECT s.id AS slot_id, s.start_time, s.end_time, s.is_available,
                s.provider_service_id, ps.check_item, ps.service_name, ps.cost,
                p.id AS provider_id, p.name AS provider_name, p.distance_km
         FROM appointment_slot s
         JOIN provider_service ps ON ps.id = s.provider_service_id
         JOIN provider p ON p.id = ps.provider_id
         WHERE s.id = ?`,
      )
      .get(slot_id);

    if (!slot || slot.is_available !== 1) {
      return c.redirect("/appointments/search");
    }

    const book = db.transaction(() => {
      db.query("UPDATE appointment_slot SET is_available = 0 WHERE id = ?").run(
        slot_id,
      );
      db.query(
        `INSERT INTO appointment
         (user_id, provider_id, slot_id, provider_name, service_name_snapshot, check_item,
          slot_start_time, slot_end_time, cost_snapshot, distance_km_snapshot)
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
    });
    book();

    return c.redirect("/appointments/search");
  });

  // --- Plans pages ---
  app.use("/plans", pageAuthRequired);
  app.page("/plans", (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);
    const plans = db
      .query<
        {
          id: number;
          code: string;
          name: string;
          description: string | null;
          effective_year: number;
          premium_monthly: number;
          deductible: number;
        },
        []
      >(
        "SELECT id, code, name, description, effective_year, premium_monthly, deductible FROM insurance_plan ORDER BY code",
      )
      .all();
    return c.html(<PlansListPage user={user} plans={plans} />);
  });

  app.use("/plans/current", pageAuthRequired);
  app.page("/plans/current", (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);
    const policy = db
      .query<
        { id: number; status: string; plan_id: number },
        [number]
      >(
        "SELECT id, status, plan_id FROM current_policy WHERE user_id = ? AND status = 'active'",
      )
      .get(userId);
    if (!policy) return c.notFound();

    const plan = db
      .query<
        {
          id: number;
          code: string;
          name: string;
          description: string | null;
          effective_year: number;
          premium_monthly: number;
          deductible: number;
        },
        [number]
      >(
        "SELECT id, code, name, description, effective_year, premium_monthly, deductible FROM insurance_plan WHERE id = ?",
      )
      .get(policy.plan_id)!;

    return c.html(<PlansCurrentPage user={user} policy={{ ...policy, plan }} />);
  });

  app.use("/plans/select", pageAuthRequired);
  app.page("/plans/select", (c) => {
    const userId = c.get("userId")!;
    const user = getCurrentUser(db, userId);
    const plans = db
      .query<
        {
          id: number;
          code: string;
          name: string;
          description: string | null;
          effective_year: number;
          premium_monthly: number;
          deductible: number;
        },
        []
      >(
        "SELECT id, code, name, description, effective_year, premium_monthly, deductible FROM insurance_plan ORDER BY code",
      )
      .all();

    const plansWithBenefits = plans.map((plan) => {
      const benefits = db
        .query<
          {
            benefit_category: string;
            coverage_type: string;
            coverage_value: number | null;
            notes: string | null;
          },
          [number]
        >(
          "SELECT benefit_category, coverage_type, coverage_value, notes FROM plan_benefit WHERE plan_id = ?",
        )
        .all(plan.id);
      return { ...plan, benefits };
    });

    return c.html(
      <PlansSelectPage user={user} plans={plansWithBenefits} />,
    );
  });
  app.post("/plans/select", pageAuthRequired, async (c) => {
    const userId = c.get("userId")!;
    const body = await c.req.parseBody();
    const plan_id = parseInt(String(body.plan_id ?? "0"), 10);

    const plan = db
      .query<
        {
          id: number;
          code: string;
          name: string;
          effective_year: number;
          premium_monthly: number;
          deductible: number;
        },
        [number]
      >(
        "SELECT id, code, name, effective_year, premium_monthly, deductible FROM insurance_plan WHERE id = ?",
      )
      .get(plan_id);

    if (!plan) {
      return c.notFound();
    }

    // Update active policy: terminate old, insert new
    db.query(
      `UPDATE current_policy SET status = 'terminated', updated_at = datetime('now') WHERE user_id = ? AND status = 'active'`,
    ).run(userId);
    db.query(
      `INSERT INTO current_policy (user_id, plan_id, status) VALUES (?, ?, 'active')`,
    ).run(userId, plan.id);

    // Record the selection event with snapshots
    db.query(
      `INSERT INTO plan_selection
       (user_id, plan_id, year, plan_code_snapshot, plan_name_snapshot, deductible_snapshot, premium_snapshot)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      userId,
      plan.id,
      plan.effective_year,
      plan.code,
      plan.name,
      plan.deductible,
      plan.premium_monthly,
    );

    return c.redirect("/plans/current");
  });

  return {
    ...mockApp,
    seed: () => {
      seedDatabase(db);
    },
  };
}

if (import.meta.main) {
  const app = createInsuranceApp();
  startServer(app);
}
