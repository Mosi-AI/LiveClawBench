Now I have everything needed for a complete, evidence-based audit.

---

# Audit Round 2: weather-outdoor-window

STATUS: **PASS**

## Summary

Both Round 1 findings were correctly addressed. The spec is internally consistent, technically accurate against the mock snapshot, and passes every checklist item. No new material issues were found. One non-blocking observation is noted (approximate temperature table for hours 10–20 overstates the low end by 1°C), but it is immaterial to the ground truth and explicitly labelled "approx".

## Findings

| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| OBS-01 | INFO (non-blocking) | internal consistency | §4 Pre-seeded Shanghai Hourly Pattern | Table row for hours 10–20 lists "21–22°C". Formula gives hour=20: `Math.round(20 + 2×cos(6π/12))` = `Math.round(20 + 0)` = 20°C, not 21°C. Minor over-approximation. Temperature is never the binding constraint (all 24 hours pass any reasonable running-temp range); "approx" label on the column already hedges this. | No fix required. Implementer should be aware. | ADVISORY |

## Previous Round Verification

| issue_id | original finding | fix claimed | actually fixed? |
|---|---|---|---|
| F-01 (MEDIUM) | §3 instruction silently removed CSV's explicit thresholds (`10–28°C`, `precip_mm = 0`) without documentation; deviation was unexplained | §8 note added: explicitly names the CSV field conflict, declares `factors` column authoritative, cross-references the same resolution applied to case 110 (weather-city-travel-pick), and notes the CSV field should be updated on next registry regeneration | **YES** — §8 now contains the full documentation. The instruction in §3 still uses implicit phrasing ("suitable for running outdoors"), and the deviation is clearly explained and justified. |
| F-02 (LOW) | §2 Task Goal named constraint dimensions "(no precipitation, comfortable temperature)", leaking the implicit B1=1 criteria | §2 rephrased to "infer appropriate outdoor-exercise conditions from domain knowledge and the visible forecast columns" | **YES** — §2 now reads: "The filtering criteria are not stated; the agent must reason from the data columns visible on the forecast page." No constraint dimensions are named. |

## Metadata Check

All fields present and match the CSV row exactly:

| field | CSV | spec | verdict |
|---|---|---|---|
| task_name | weather-outdoor-window | weather-outdoor-window | ✓ |
| case_id | 111 | 111 | ✓ |
| ability_category | proactive decision making | proactive decision making | ✓ |
| domain | Health & Wellness | Health & Wellness | ✓ |
| domains_multi | Health & Wellness | ["Health & Wellness"] | ✓ |
| difficulty | H | "hard" | ✓ |
| A1/A2/B1/B2 | 0/0/1/0 | 0/0/1/0 | ✓ |
| registry_description | exact text | exact match | ✓ |
| allow_internet | required (mock service) | `allow_internet = true` | ✓ |
| tags | — | `["outdoor_exercise", "health_wellness"]` snake_case, domain-aligned | ✓ |
| `capability_dimension` | — | absent (deprecated field not added) | ✓ |

## Instruction Leakage Check

- §3 instruction: uses only "suitable for running outdoors" — no explicit temperature bounds, no precipitation threshold. B1=1 compliant. ✓
- No scoring rules, correct answers, verifier filenames, or thresholds appear in §2 or §3. ✓
- URL includes "(open it in your browser)" browser hint. ✓
- Output paths are Linux container paths (`/workspace/output/exercise_window.json`). ✓
- §5 correct answer (`start_hour=0, end_hour=9, duration_hours=10`) is labelled `*Hidden from instruction.md*` and is implementer-facing only. ✓
- §5 explicit thresholds (`temp_c ∈ [10, 28]`, `precip_mm == 0`) are in the reference path section, not in §2 or §3. ✓

## Environment and Verifier Check

| item | spec claim | verdict |
|---|---|---|
| Dockerfile base | `liveclawbench-weather-outdoor-window-base:latest` | ✓ matches `liveclawbench-{task}-base:latest` pattern |
| task-binary-map.json | entry for `weather-outdoor-window` → `weather` binary required | ✓ noted in §8 |
| Mock precip formula | `daily_precip/11 ≈ 0.36mm` for hours 10–20; renders as "0.4" in HTML (0.364 rounds to 1dp) | ✓ internally consistent; non-zero for hours 10–20 |
| Ground truth | hours 0–9 (10 hrs), hours 21–23 (3 hrs); winner: 0–9 | ✓ matches mock snapshot |
| Verifier weights | 0.4 + 0.4 + 0.2 = 1.0 | ✓ |
| reward.json field types | all `float\|int`; no string values; `_meta_` prefix not needed | ✓ |
| Zero-work baseline | 0.0 | ✓ |
| Score threshold | exit non-zero if score < 0.5 | ✓ |
| test.sh | non-suppressing exit code required; noted in §8 | ✓ |
| tomorrow-row pitfall | page shows 30 rows (24 today + 6 tomorrow); pitfall documented in §8 | ✓ robust — even if agent mistakenly includes tomorrow, longest window is still 0–9 (10 hrs > max possible misread of 9 hrs) |

## Unresolved Issue Summary

None.
