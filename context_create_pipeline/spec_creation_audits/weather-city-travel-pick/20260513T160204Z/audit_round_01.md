# Audit Round 1: weather-city-travel-pick

STATUS: FAIL

## Summary

Two rule violations found. The most serious is a direct self-contradiction: the spec annotates B1=1 (implicit goal resolution) while the instruction explicitly states both filtering thresholds, and Section 8 falsely asserts the thresholds are omitted. The second violation is a misaligned tag. A naming-convention concern on the Dockerfile base image is also noted.

## Findings

| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| F-01 | FAIL | Task Goal / Leakage — "No … thresholds in … Instruction"; Structure — factors must be accurate | §1 factors_supported, §3 Instruction, §8 | B1=1 asserts implicit goal resolution. §8 states "instruction omits exact thresholds intentionally." Yet §3 instruction reads: "Find cities where the current AQI is below 100 AND today's high temperature is between 15°C and 28°C" — both thresholds are explicit. The registry_description also uses the word "implicit." The annotation, the instruction, and §8 are mutually contradictory. | Either (a) remove the explicit numeric thresholds from the instruction so the agent must infer them (preserving B1=1), or (b) change B1 to 0 and remove all "implicit" language from §1, §2, §8, and registry_description. | UNRESOLVED |
| F-02 | FAIL | Structure — "Tags snake_case, align with domain" | §1 task.toml block | `tags = ["deep_research_report", "health_wellness"]`. Domain is `"Health & Wellness"`. The tag `deep_research_report` corresponds to the "Deep Research & Report" domain used by tasks like `noise-filtering` and `live-web-research-sqlite-fts5`, not to this task's domain. | Replace `deep_research_report` with a tag that aligns with Health & Wellness (e.g., `travel_planning` or `health_wellness` alone). | UNRESOLVED |
| W-01 | WARN | Environment — "Dockerfile base liveclawbench-base:latest or ARG variant" | §8 | §8 states Dockerfile inherits from `liveclawbench-weather-base:latest`. Per CLAUDE.md convention (`liveclawbench-{task}-base:latest`), the expected per-task base for this task is `liveclawbench-weather-city-travel-pick-base:latest`. A generic `liveclawbench-weather-base:latest` does not match either the shared-base or per-task-name pattern described in CLAUDE.md. | Verify against `mock-platform/config/task-binary-map.json` and `build-task-images.ts`. Update §8 (and the Dockerfile) to use the correct per-task image name. | UNRESOLVED |

## Previous Round Verification

Not applicable.

## Metadata Check

All eight required sections are present in order. `task_name` is kebab-case and matches the output file name. Case Metadata contains all required fields. `domains_multi[0]` matches `domain` ("Health & Wellness"). `case_id` 110 matches the CSV row. `registry_description` is copied verbatim from the CSV. `difficulty` is consistently "hard" in the CSV row, §1 prose, and task.toml. No deprecated `capability_dimension` field is present. The task.toml block includes `allow_internet = true`. The only structural defect is the misaligned `deep_research_report` tag (F-02).

## Instruction Leakage Check

The instruction is well over 100 characters and reads as a genuine user request. The URL uses `http://localhost:3000/` with the required "(open it in your browser)" qualifier. All paths are Linux container paths (`/workspace/output/travel_pick.json`). The correct answer (上海, AQI=35, temp=22) is not stated in the instruction; it appears only in §5 under a "*Hidden from instruction.md*" label, which is appropriate for a spec document. However, the explicit `AQI < 100` and `temp between 15°C and 28°C` thresholds in the instruction directly contradict B1=1 and may constitute task-filtering threshold leakage depending on interpretation — this is the core of F-01.

## Environment And Verifier Check

The verifier design is internally consistent: three dimensions sum to 1.0 (0.4 + 0.3 + 0.3), each has weight, state-read field, and criterion. `reward.json` uses `_meta_` prefixes for non-numeric fields (`_meta_city_got`, `_meta_aqi_got`). `reward.txt` is specified. Zero-work baseline is 0.0. `test.sh` is noted as non-stub. "Score: X.X/1.0" printed; exit non-zero if score < 0.5. No hard-coded API keys or model IDs. The Dockerfile base-name concern (W-01) is a warning, not a blocking environment failure.

## Unresolved Issue Summary

- **F-01 (FAIL)**: B1=1 annotation irreconcilably contradicts explicit thresholds in the instruction; §8 falsely describes the thresholds as omitted. Must resolve by either making thresholds implicit or downgrading B1 to 0.
- **F-02 (FAIL)**: Tag `deep_research_report` does not align with the `Health & Wellness` domain.
- **W-01 (WARN)**: Dockerfile base image name `liveclawbench-weather-base:latest` may not follow the per-task naming convention; needs verification.
