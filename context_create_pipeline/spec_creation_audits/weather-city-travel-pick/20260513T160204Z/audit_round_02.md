# Audit Round 2: weather-city-travel-pick

STATUS: PASS

## Summary

All three Round 1 findings are confirmed fixed. The spec is structurally sound, internally consistent, and passes every material checklist item. Two minor warnings remain (neither blocks implementation) and one informational gap is noted.

## Findings

| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| W-02 | WARN | reward.txt + reward.json with _meta_ prefix for non-numeric | §6 | `_meta_aqi_got: N` uses `_meta_` prefix on what the spec denotes as a numeric (integer AQI). Harbor's model enforces `dict[str, float\|int]`; numeric fields do not need the prefix. Harmless but inconsistent with the convention's stated rationale. | Either drop the prefix (→ `aqi_got`) or add a clarifying note that `_meta_` is intentional to exclude it from aggregate metric scoring. | NEW / Non-blocking |
| W-03 | WARN | reward.json completeness | §6 | reward.json specifies `_meta_city_got` and `_meta_aqi_got` diagnostics but omits a `_meta_temp_got` field. If Dim3 fails, there is no logged evidence of what temp_high_c the agent wrote. | Add `_meta_temp_got` to reward.json schema for diagnostic parity with Dim1 and Dim2. | NEW / Non-blocking |
| I-01 | INFO | verifier design consistency | §6 | Dim3 uses ±1 tolerance around 22 while Dim2 uses exact match for AQI=35. The seed value for 上海 temp_high_c is deterministically 22 (integer); ±1 adds no coverage over exact match unless HTML parsing can introduce rounding. Not wrong, but inconsistency should be a deliberate decision. | Document the rationale (e.g., "HTML page may render as 21 or 23 due to rounding") or tighten to exact match if JSON is the intended data source. | NEW / Informational |

## Previous Round Verification

| finding | original verdict | current status |
|---|---|---|
| F-01: B1=1 conflicted with explicit thresholds in §3 | FAIL | **FIXED** — §3 instruction contains only qualitative language ("good air quality and comfortable temperatures"); no numeric thresholds present. |
| F-02: tag `deep_research_report` misaligned with domain | FAIL | **FIXED** — tags are now `["travel_planning", "health_wellness"]`, both snake_case and aligned with the Health & Wellness domain. |
| W-01: wrong Dockerfile base image name | WARN | **FIXED** — §1 and §8 both reference `liveclawbench-weather-city-travel-pick-base:latest`; task-binary-map.json entry noted in §8. |

## Metadata Check

All CSV fields map cleanly to the spec:
- `case_id=110`, `difficulty=H/hard`, `ability_category=proactive decision making`, `domain=Health & Wellness`, `domains_multi=Health & Wellness` — all match exactly.
- Factors `A1=0, A2=0, B1=1, B2=0` consistent across CSV, §1, and suggested task.toml.
- `registry_description` in CSV matches §1 verbatim.
- `allow_internet = true` present in task.toml. No deprecated `capability_dimension` field.
- Score ≥ 0.5 to pass aligns with verifier exit-code logic and partial-credit structure (min passing path: city correct = 0.4; any one additional dim = 0.7).

## Instruction Leakage Check

§3 passes the B1=1 constraint. The instruction contains no numeric thresholds, no AQI cutoffs, no temperature bounds, and no reference to the five specific city slugs by name. The phrase "all five available cities" tells the agent the count but does not expose the filtering logic. §5 correctly labels the hidden filter (`aqi < 100 AND temp_high_c >= 15 AND temp_high_c <= 28`) as implementation-internal. No scoring or verifier language appears in §2 or §3.

Convergence check: regardless of reasonable threshold interpretation, 上海 is the uniquely correct answer — it is the only city with simultaneously "good" AQI category and non-extreme temperature (深圳 is too hot at 30°C, 哈尔滨 too cold at 12°C, 成都 has unhealthy AQI at 120, 北京's AQI is moderate at 75 vs 上海's good at 35). B1=1 designation is substantiated.

## Environment And Verifier Check

- Five-city seed table is internally consistent; values match §5 elimination logic exactly.
- Dim weights sum to 1.0 (0.4 + 0.3 + 0.3).
- Zero-work baseline = 0.0 stated explicitly.
- Missing/invalid JSON → 0.0, exit 1 specified.
- `_meta_city_got` correctly uses `_meta_` prefix (string value).
- `Score: X.X/1.0` print and exit-nonzero-if-score<0.5 both present.
- All six required files listed in §7.
- §8 pitfalls cover: Chinese city name, integer types, date-aware seed note, test.sh exit-code note.

## Unresolved Issue Summary

None that block implementation. W-02 and W-03 are documentation/diagnostic improvements; I-01 is a clarification request on an intentional design choice. The spec is ready to implement.
