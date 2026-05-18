# Audit Round 2: weather-city-travel-pick

STATUS: PASS

## Summary

F-01 from Round 1 is fully resolved. The renumbering introduced no regressions. All spec facts are preserved verbatim, the verifier skeleton is correct, the reward schema conforms to harbor conventions, and internal step dependencies are consistent throughout. No new findings.

## Findings

| issue_id | severity | checklist_source | plan_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| — | — | — | — | No material issues found | — | — |

## Previous Round Verification

F-01 is resolved. Evidence:

- **Step 2 exists** with a correctly structured CSV row: `110,proactive decision making,weather-city-travel-pick,...,H,...,Health & Wellness,Health & Wellness,0,0,1,0,planned` — all columns (case_id, ability_category, task_name, description, difficulty, extended description, domain, domains_multi, A1–B2 flags, status) are present and match the spec.
- **Acceptance checks are achievable**: `grep "^110," docs/metadata/cases_registry.csv` and `python scripts/validate_annotations.py` are both executable gates that can succeed once the row is appended.
- **§3 Source Assets And Reuse Map** includes `docs/metadata/cases_registry.csv` with action "Append one new row for case_id=110".
- **Renumbering is correct**: former Steps 2–8 are now Steps 3–9 exactly. All `Depends on:` clauses were updated: Step 4 → Step 3, Step 5 → Step 3, Step 6 → Steps 1 and 3, Step 7 → Step 3, Step 8 → Step 7, Step 9 → Steps 4–8. No stale old-number reference found.

## Spec Preservation Check

All critical spec facts are preserved:

- `task.toml` block in Step 4 matches spec §1 verbatim, including `allow_internet = true`, all factor flags, all timeouts, and `case_id = 110`.
- `instruction.md` content in Steps 5 and §7 matches spec §3 exactly; no oracle values (上海, 35, 22) or numeric thresholds (15, 28, 100) leak through.
- City seed table (5 rows) matches spec §4 exactly, including slug, display_name, temp_high_c, AQI, category, and qualify column.
- Expected behavior/reference path in §2 matches spec §5 step-for-step.
- All 6 required files from spec §7 are listed in §3 and built in Steps 3–9.
- All implementation pitfalls from spec §8 are carried through (Chinese city name, integer types, date-aware mock, B1=1 threshold omission, reason field not verified).
- Dockerfile inherits from `liveclawbench-weather-city-travel-pick-base:latest` as required.

## Domain-Specific Trace Check

The Domain-Specific Data Trace table contains 5 rows (exceeds the 3-row minimum) and is fully concrete:

- Each row names specific fields (`aqi`, `temp_high_c`, `city`), seed values, and verifier assertions.
- All verifier-reading rows (Rows 1, 4, 5) are cross-referenced to Dim2, Dim1, and Dim1 in the Verifier Integrity Trace respectively.
- AQI values (22, 28, 35, 75, 120) span the EPA band boundaries plausibly; temperature values (12, 22, 23, 28, 30) are realistic seasonal highs for the named Chinese cities.
- No medical claims; framing is "travel comfort" throughout.
- Distractor design is documented per city: 深圳 tests temp upper bound with deceptively low AQI; 哈尔滨 tests temp lower bound with lowest AQI; 成都 tests AQI threshold with comfortable temp; 北京 is a near-miss requiring AQI comparison.

## Verifier Integrity Check

- **All three spec dimensions present** with correct weights: Dim1=0.4, Dim2=0.3, Dim3=0.3; sum=1.0 ✓
- **State reads identified**: all three dimensions read `/workspace/output/travel_pick.json` via the named fields `city`, `aqi`, `temp_high_c`.
- **Missing/malformed policy**: exception handler calls `write_reward(0.0, 0, 0, 0, "", -1)`, prints `Score: 0.0/1.0`, exits 1. ✓
- **Type guards**: `isinstance(aqi, int)` and `isinstance(temp, int)` prevent float or string values from scoring. ✓
- **reward.json schema** matches spec §6 exactly: `reward`, `dim_city`, `dim_aqi`, `dim_temp` are numeric; string fields `_meta_city_got` and `_meta_aqi_got` use the `_meta_` prefix per harbor's `dict[str, float | int]` enforcement. ✓
- **reward.txt**: `f.write(str(reward))` emits a scalar float string. ✓
- **test.sh**: `set -e` + `python3 /tests/verify.py` as last command propagates verify.py exit code without suppression; uses `/tests/` path; creates `/logs/verifier/` before verify.py runs (verify.py's `exist_ok=True` handles the already-existing directory gracefully). ✓
- **Zero-work baseline**: file absent → exception path → reward 0.0. ✓
- **Acceptance tests in Step 7** are internally consistent: wrong city yields 0.6 (0.0+0.3+0.3 ≥ 0.5 → exit 0); missing file yields 0.0 → exit 1.

## Unresolved Issue Summary

None.
