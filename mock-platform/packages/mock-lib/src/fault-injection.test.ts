import { describe, expect, it } from "bun:test";
import {
  hasFired,
  resetInjectionState,
  shouldInject,
} from "./fault-injection";

/** A real registered fault tuple used throughout the positive-path tests. */
const REAL_TASK = "watch-shop-stockout";
const REAL_SVC = "shop";
const REAL_ROUTE = "POST /api/checkout";
const REAL_FAULT = "c1-stockout";

/** Another real registered tuple (different fault on same route). */
const REAL_TASK_2 = "watch-shop-silent-fail";
const REAL_FAULT_2 = "c2-skip-persist";

describe("fault-injection", () => {
  it("returns true on first call, false thereafter (one-shot)", () => {
    resetInjectionState();
    expect(shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(true);
    expect(shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
    expect(shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
  });

  it("independently tracks different fault tuples", () => {
    resetInjectionState();
    expect(shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(true);
    expect(shouldInject(REAL_TASK_2, REAL_SVC, REAL_ROUTE, REAL_FAULT_2)).toBe(true);
    expect(shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
    expect(shouldInject(REAL_TASK_2, REAL_SVC, REAL_ROUTE, REAL_FAULT_2)).toBe(false);
  });

  it("resetInjectionState allows re-firing", () => {
    resetInjectionState();
    expect(shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(true);
    resetInjectionState();
    expect(shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(true);
  });

  it("hasFired reports state without triggering", () => {
    resetInjectionState();
    expect(hasFired(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
    shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT);
    expect(hasFired(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(true);
    // hasFired does not consume the one-shot
    expect(hasFired(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(true);
  });

  it("returns false for null taskName without recording state", () => {
    resetInjectionState();
    expect(shouldInject(null, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
    // State should remain empty — no entry was created
    expect(hasFired("null", REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
  });

  it("returns false for undefined taskName without recording state", () => {
    resetInjectionState();
    expect(shouldInject(undefined, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
  });

  it("returns false for empty-string parameters", () => {
    resetInjectionState();
    expect(shouldInject("", REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
    expect(shouldInject(REAL_TASK, "", REAL_ROUTE, REAL_FAULT)).toBe(false);
  });

  it("returns false for arbitrary non-target task names", () => {
    resetInjectionState();
    expect(shouldInject("some-random-task", REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
    expect(shouldInject("different-task", REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
    // State should remain empty — no entries were created
    expect(hasFired("some-random-task", REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
    expect(hasFired("different-task", REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
  });

  it("registered task works after non-target rejection", () => {
    resetInjectionState();
    // Non-registered task is rejected without recording state
    expect(shouldInject("some-random-task", REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
    // Registered task should still fire normally
    expect(shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(true);
    expect(shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Tuple-level registration (AC-2 hardening)
  // ---------------------------------------------------------------------------

  it("returns false for arbitrary service/route/fault on registered task", () => {
    resetInjectionState();
    // Registered task name, but fake tuple
    expect(shouldInject(REAL_TASK, "svc", "r", "f")).toBe(false);
    expect(shouldInject(REAL_TASK, REAL_SVC, "GET /fake", "c1-fake")).toBe(false);
    // State must remain empty
    expect(hasFired(REAL_TASK, "svc", "r", "f")).toBe(false);
    expect(hasFired(REAL_TASK, REAL_SVC, "GET /fake", "c1-fake")).toBe(false);
  });

  it("real tuple fires after arbitrary tuple rejection on same task", () => {
    resetInjectionState();
    // Fake tuple rejected
    expect(shouldInject(REAL_TASK, "svc", "r", "f")).toBe(false);
    // Real tuple should still fire
    expect(shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(true);
    expect(shouldInject(REAL_TASK, REAL_SVC, REAL_ROUTE, REAL_FAULT)).toBe(false);
  });
});
