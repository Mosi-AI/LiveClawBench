/**
 * Fault-injection helpers for C-axis (Runtime Adaptability) tasks.
 *
 * C1 — Environmental State Invalidation: the mock changes behavior after the
 *       agent's first request, forcing replanning.
 * C2 — Outcome Verification under Altered State: the first attempt appears to
 *       succeed but silently fails; verification catches it and a retry works.
 *
 * All injection is gated on `process.env.TASK_NAME` so mocks remain safe for
 * non-C-axis tasks (default branches preserve original behavior).
 */

/** Opaque key for tracking one-shot fault state. */
type FaultKey = `${string}::${string}::${string}::${string}`;

const fired = new Set<FaultKey>();

function makeKey(
  taskName: string,
  service: string,
  route: string,
  faultId: string,
): FaultKey {
  return `${taskName}::${service}::${route}::${faultId}`;
}

/**
 * Should this fault be injected?
 *
 * Returns `true` the **first** time it is called for a given
 * `(taskName, service, route, faultId)` tuple within this process,
 * then `false` on every subsequent call — one-shot semantics.
 *
 * @param taskName  Value of `process.env.TASK_NAME` (the running task directory name).
 * @param service   Mock service name, e.g. `"email"`, `"shop"`.
 * @param route     Route identifier, e.g. `"POST /api/send"`.
 * @param faultId   Arbitrary label distinguishing different faults on the same route,
 *                  e.g. `"c1-stockout"`, `"c2-silent-fail"`.
 */
export function shouldInject(
  taskName: string | undefined | null,
  service: string | undefined | null,
  route: string | undefined | null,
  faultId: string | undefined | null,
): boolean {
  if (!taskName || !service || !route || !faultId) {
    return false;
  }
  const key = makeKey(taskName, service, route, faultId);
  if (fired.has(key)) {
    return false;
  }
  fired.add(key);
  return true;
}

/**
 * Reset all injection state.
 *
 * Intended for test isolation — call in `beforeEach` / `afterEach` so each
 * test case starts with a clean one-shot map.
 */
export function resetInjectionState(): void {
  fired.clear();
}

/**
 * Query whether a specific fault has already fired (without triggering it).
 * Useful in test assertions.
 */
export function hasFired(
  taskName: string,
  service: string,
  route: string,
  faultId: string,
): boolean {
  return fired.has(makeKey(taskName, service, route, faultId));
}
