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

/** Registered C-axis tasks that may trigger fault injection. */
const REGISTERED_TASKS = new Set([
  "email-reply-context-shift",
  "email-sending-verify",
  "watch-shop-stockout",
  "watch-shop-silent-fail",
  "meeting-slot-race",
  "interview-slot-verify",
  "mint-diet-stockout",
  "health-record-verify",
  "social-post-rate-limit",
  "social-unlike-verify",
  "expense-submit-verify",
  "finance-budget-shift",
  "vue-fix-rebreak",
]);

/** Registered fault tuples that are eligible for injection.
 *
 * Each entry is a `taskName::service::route::faultId` string.
 * Only these exact tuples may trigger fault injection; arbitrary
 * tuples for even registered task names return false.
 */
const REGISTERED_FAULTS = new Set<FaultKey>([
  "email-reply-context-shift::email::GET /api/emails?folder=inbox::c1-cancellation",
  "email-sending-verify::email::PUT /api/emails/:id/send::c2-skip-persist",
  "watch-shop-stockout::shop::POST /api/checkout::c1-stockout",
  "watch-shop-silent-fail::shop::POST /api/checkout::c2-skip-persist",
  "meeting-slot-race::calendar::POST /api/events::c1-slot-race",
  "interview-slot-verify::calendar::POST /api/events::c2-wrong-time",
  "mint-diet-stockout::mint-diet::GET /api/food-catalog/search::c1-food-delete",
  "health-record-verify::health::POST /api/allergens::c2-skip-persist",
  "health-record-verify::health::POST /api/medications::c2-skip-persist",
  "social-post-rate-limit::social::POST /api/posts::c1-rate-limit",
  "social-unlike-verify::social::POST /api/posts/:id/like::c2-skip-unlike",
  "expense-submit-verify::expense::POST /api/drafts/:id/submit::c2-skip-submit",
  "finance-budget-shift::finance::POST /api/departments/budget-alerts::c1-budget-shift",
]);

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
 * Only registered C-axis tasks are eligible for fault injection;
 * arbitrary non-target task names return `false` without recording state.
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
  if (!REGISTERED_TASKS.has(taskName)) {
    return false;
  }
  const key = makeKey(taskName, service, route, faultId);
  if (!REGISTERED_FAULTS.has(key)) {
    return false;
  }
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
