// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Room Metrics
export interface RoomMetrics {
  temperature: number;
  humidity: number;
  unit_temp: string;
  noise?: number;
  light?: number;
  air_quality?: number;
}

// Thermostat
export type ThermostatMode = "comfort" | "eco" | "off";

export interface ThermostatSettings {
  id: number;
  mode: ThermostatMode;
  temperature: number;
  updated_at: string;
}

// Coffee Schedule
export interface CoffeeSchedule {
  schedule_date: string;
  start_time: string | null;
  status: string;
  beans_grams: number | null;
  cancelled: boolean;
  updated_at: string | null;
  has_schedule: boolean;
}

// Inventory
export interface InventoryItem {
  id: number;
  item_name: string;
  quantity: number;
  unit: string;
  location: string;
  expiry_date?: string;
  category?: string;
}

// Grocery
export interface GroceryProduct {
  product_id: string;
  name: string;
  quantity: number;
  unit: string;
  stock_status: "sufficient" | "insufficient" | "unavailable";
  substitute_for?: string;
  reference?: string; // Optional order_id from shop mock
}

// Wearable/Recovery
export interface WearableRecovery {
  sleep_hours: number;
  sleep_score: number;
  readiness: number;
  resting_heart_rate: number;
}

// Calendar/Workout
export type WorkoutType = "hiit" | "yoga" | "walking" | "cycling" | "strength" | "swimming" | "rest";

export interface CalendarEvent {
  id: number;
  title: string;
  start_time: string;
  event_type?: string;
  workout_type?: WorkoutType;
  status: "done" | "undone";
  updated_at: string;
}

// Meal Planning
export interface UserConstraints {
  calorie_target: number;
  macro_targets: string;
  allergy_constraints: string;
  weekly_budget_limit: number;
}

export interface Recipe {
  id: number;
  name: string;
  meal_type: "breakfast" | "lunch" | "dinner";
  ingredients: string;
  calories_total: number;
  allergens?: string;
}

export interface MealPlan {
  id: number;
  plan_id: string;
  created_at: string;
  plan_data: string;
}

// Benchmark Clock
export interface BenchmarkClock {
  id: number;
  clock_time: string;
}
