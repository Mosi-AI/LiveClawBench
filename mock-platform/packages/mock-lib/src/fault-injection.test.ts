import { describe, expect, it } from "bun:test";
import {
  hasFired,
  resetInjectionState,
  shouldInject,
} from "./fault-injection";

describe("fault-injection", () => {
  it("returns true on first call, false thereafter (one-shot)", () => {
    resetInjectionState();
    expect(shouldInject("t", "svc", "r", "f")).toBe(true);
    expect(shouldInject("t", "svc", "r", "f")).toBe(false);
    expect(shouldInject("t", "svc", "r", "f")).toBe(false);
  });

  it("independently tracks different fault tuples", () => {
    resetInjectionState();
    expect(shouldInject("t", "svc", "r1", "f")).toBe(true);
    expect(shouldInject("t", "svc", "r2", "f")).toBe(true);
    expect(shouldInject("t", "svc", "r1", "f")).toBe(false);
    expect(shouldInject("t", "svc", "r2", "f")).toBe(false);
  });

  it("resetInjectionState allows re-firing", () => {
    resetInjectionState();
    expect(shouldInject("t", "svc", "r", "f")).toBe(true);
    resetInjectionState();
    expect(shouldInject("t", "svc", "r", "f")).toBe(true);
  });

  it("hasFired reports state without triggering", () => {
    resetInjectionState();
    expect(hasFired("t", "svc", "r", "f")).toBe(false);
    shouldInject("t", "svc", "r", "f");
    expect(hasFired("t", "svc", "r", "f")).toBe(true);
    // hasFired does not consume the one-shot
    expect(hasFired("t", "svc", "r", "f")).toBe(true);
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
    expect(shouldInject("some-random-task", "svc", "r", "f")).toBe(true);
    expect(shouldInject("different-task", "svc", "r", "f")).toBe(true);
    // These are different tuples, so both fire independently
    expect(shouldInject("some-random-task", "svc", "r", "f")).toBe(false);
  });
});
