/** @jsxImportSource hono/jsx */
import type { OpenAPIApp } from "mock-lib";
import { assertDb, deriveCoffeeStatus, getBenchmarkTime } from "../db";
import {
  CalendarPage,
  CoffeePage,
  DashboardPage,
  ErrorPage,
  GroceryPage,
  InventoryPage,
  MealPlanPage,
  ThermostatPage,
  WearablePage,
} from "../pages";
import type {
  CalendarEvent,
  GroceryProduct,
  InventoryItem,
  MealPlan,
  Recipe,
  RoomMetrics,
  ThermostatSettings,
  UserConstraints,
  WearableRecovery,
} from "../types";

export function registerPageRoutes(app: OpenAPIApp): void {
  app.page("/", (c) => {
    const database = assertDb();
    const metrics = database.query("SELECT * FROM room_metrics LIMIT 1").get() as RoomMetrics;
    const thermostat = database.query("SELECT * FROM thermostat_settings WHERE id = 1").get() as ThermostatSettings;

    if (!metrics || !thermostat) {
      return c.html(<ErrorPage title="Service Error" message="Required data unavailable. Please check system configuration." />, 500);
    }

    return c.html(<DashboardPage metrics={metrics} thermostat={thermostat} />);
  });

  app.page("/thermostat", (c) => {
    const database = assertDb();
    const thermostat = database.query("SELECT * FROM thermostat_settings WHERE id = 1").get() as ThermostatSettings;

    if (!thermostat) {
      return c.html(<ErrorPage title="Service Error" message="Thermostat data unavailable. Please check system configuration." />, 500);
    }

    return c.html(<ThermostatPage thermostat={thermostat} />);
  });

  app.page("/coffee", (c) => {
    const database = assertDb();
    const schedule = database.query("SELECT start_time, beans_grams, cancelled, updated_at FROM coffee_schedule WHERE id = 1").get() as { start_time: string; beans_grams: number; cancelled: number; updated_at: string };
    const clock = database.query("SELECT clock_time FROM benchmark_clock WHERE id = 1").get() as { clock_time: string };

    if (!schedule) {
      return c.html(<ErrorPage title="Service Error" message="Coffee schedule data unavailable." />, 500);
    }

    const status = clock ? deriveCoffeeStatus(schedule.start_time, clock.clock_time) : "scheduled";
    return c.html(<CoffeePage schedule={{ start_time: schedule.start_time, status, beans_grams: schedule.beans_grams, cancelled: schedule.cancelled === 1, updated_at: schedule.updated_at }} />);
  });

  app.page("/inventory", (c) => {
    const database = assertDb();
    const items = database.query("SELECT * FROM inventory_item ORDER BY location, item_name").all() as InventoryItem[];
    return c.html(<InventoryPage items={items} />);
  });

  app.page("/grocery", (c) => {
    const database = assertDb();
    const products = database.query("SELECT * FROM grocery_product ORDER BY name").all() as GroceryProduct[];
    return c.html(<GroceryPage products={products} />);
  });

  app.page("/wearable", (c) => {
    const database = assertDb();
    const data = database.query("SELECT sleep_hours, sleep_score, readiness, resting_heart_rate FROM wearable_recovery_state WHERE id = 1").get() as WearableRecovery;

    if (!data) {
      return c.html(<ErrorPage title="Service Error" message="Wearable data unavailable." />, 500);
    }

    const today = getBenchmarkTime().split("T")[0];
    return c.html(<WearablePage data={data} date={today} />);
  });

  app.page("/calendar", (c) => {
    const database = assertDb();
    const events = database.query("SELECT * FROM calendar_event ORDER BY start_time").all() as CalendarEvent[];
    return c.html(<CalendarPage events={events} />);
  });

  app.page("/meal-plan", (c) => {
    const database = assertDb();
    const constraints = database.query("SELECT * FROM user_constraints WHERE id = 1").get() as UserConstraints;
    const recipes = database.query("SELECT * FROM recipe ORDER BY meal_type, name").all() as Recipe[];
    const currentPlan = database.query("SELECT plan_id, created_at, plan_data FROM meal_plan ORDER BY created_at DESC, id DESC LIMIT 1").get() as MealPlan | null;

    if (!constraints) {
      return c.html(<ErrorPage title="Service Error" message="Constraints data unavailable. Please check system configuration." />, 500);
    }

    return c.html(<MealPlanPage constraints={constraints} recipes={recipes} currentPlan={currentPlan} />);
  });
}
