import { describe, expect, it } from "bun:test";
import {
  hasFired,
  resetInjectionState,
  shouldInject,
} from "./fault-injection";

const TEST_TASK = "watch-shop-stockout";

describe("fault-injection", () => {
  it("returns true on first call, false thereafter (one-shot)", () => {
    resetInjectionState();
    expect(shouldInject(TEST_TASK, "svc", "r", "f")).toBe(true);
    expect(shouldInject(TEST_TASK, "svc", "r", "f")).toBe(false);
    expect(shouldInject(TEST_TASK, "svc", "r", "f")).toBe(false);
  });

  it("independently tracks different fault tuples", () => {
    resetInjectionState();
    expect(shouldInject(TEST_TASK, "svc", "r1", "f")).toBe(true);
    expect(shouldInject(TEST_TASK, "svc", "r2", "f")).toBe(true);
    expect(shouldInject(TEST_TASK, "svc", "r1", "f")).toBe(false);
    expect(shouldInject(TEST_TASK, "svc", "r2", "f")).toBe(false);
  });

  it("resetInjectionState allows re-firing", () => {
    resetInjectionState();
    expect(shouldInject(TEST_TASK, "svc", "r", "f")).toBe(true);
    resetInjectionState();
    expect(shouldInject(TEST_TASK, "svc", "r", "f")).toBe(true);
  });

  it("hasFired reports state without triggering", () => {
    resetInjectionState();
    expect(hasFired(TEST_TASK, "svc", "r", "f")).toBe(false);
    shouldInject(TEST_TASK, "svc", "r", "f");
    expect(hasFired(TEST_TASK, "svc", "r", "f")).toBe(true);
    // hasFired does not consume the one-shot
    expect(hasFired(TEST_TASK, "svc", "r", "f")).toBe(true);
  });

  it("returns false for null taskName without recording state", () => {
    resetInjectionState();
    expect(shouldInject(null, "svc", "r", "f")).toBe(false);
    // State should remain empty — no entry was created
    expect(hasFired("null", "svc", "r", "f")).toBe(false);
  });

  it("returns false for undefined taskName without recording state", () => {
    resetInjectionState();
    expect(shouldInject(undefined, "svc", "r", "f")).toBe(false);
  });

  it("returns false for empty-string parameters", () => {
    resetInjectionState();
    expect(shouldInject("", "svc", "r", "f")).toBe(false);
    expect(shouldInject("t", "", "r", "f")).toBe(false);
  });

  it("returns false for arbitrary non-target task names", () => {
    resetInjectionState();
    expect(shouldInject("some-random-task", "svc", "r", "f")).toBe(false);
    expect(shouldInject("different-task", "svc", "r", "f")).toBe(false);
    // State should remain empty — no entries were created
    expect(hasFired("some-random-task", "svc", "r", "f")).toBe(false);
    expect(hasFired("different-task", "svc", "r", "f")).toBe(false);
  });

  it("registered task works after non-target rejection", () => {
    resetInjectionState();
    // Non-registered task is rejected without recording state
    expect(shouldInject("some-random-task", "svc", "r", "f")).toBe(false);
    // Registered task should still fire normally
    expect(shouldInject("watch-shop-stockout", "svc", "r", "f")).toBe(true);
    expect(shouldInject("watch-shop-stockout", "svc", "r", "f")).toBe(false);
  });
});
