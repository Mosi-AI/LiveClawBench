# Audit Round 1: weather-city-travel-pick

STATUS: FAIL

## Summary

The plan is largely faithful to the spec and well-structured: spec preservation is complete, the domain-specific trace is detailed, the verifier skeleton is correct, and all six required task files have concrete content. One material gap causes the FAIL: the plan omits an explicit step to add the task entry to `docs/metadata/cases_registry.csv`, yet Step 3's own acceptance criterion claims `python scripts/validate_annotations.py` will pass — a script that CLAUDE.md explicitly states cross-checks that file. The plan is internally self-contradictory on this point.

## Findings

| issue_id | severity | checklist_source | plan_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| F-01 | CRITICAL | path realism / self-containedness (CLAUDE.md "Adding a New Task" step 7; validate_annotations.py cross-checks cases_registry.csv) | §4 Step-By-Step Build Plan; §10 Validation And Audit Plan | Plan lists `python scripts/validate_annotations.py` as an acceptance criterion in Step 3, but no build step adds case_id=110 to `docs/metadata/cases_registry.csv`. CLAUDE.md explicitly requires checking/updating this file when adding a new task. The Source Assets And Reuse Map (§3) also omits this file entirely. If the registry lacks the entry, `validate_annotations.py` will fail, invalidating Step 3's acceptance check. | Add a build step (e.g., Step 1b or Step 9) that appends the new task row (case_id=110, task_name=weather-city-travel-pick, domain, factors, difficulty) to `docs/metadata/cases_registry.csv`; add the file to §3 Source Assets And Reuse Map. | UNRESOLVED |

## Previous Round Verification

Not applicable.

## Spec Preservation Check

All critical spec facts are preserved correctly:
- task_name, case_id (110), difficulty (hard), domain, domains_multi, factors (A1=0, A2=0, B1=1, B2=0) all match spec §1.
- Agent instruction draft copied verbatim from spec §3 with no numeric threshold or oracle leakage.
- Pre-seeded city data table matches spec §4 exactly (5 cities, deterministic values).
- Reference path and filter logic (`aqi < 100 AND temp_high_c ∈ [15, 28]`, winner = 上海) preserved from spec §5.
- All three verifier dimensions (weights 0.4/0.3/0.3, criteria, file-missing policy) preserved from spec §6.
- Required files list matches spec §7 exactly.
- All spec §8 pitfalls (Chinese string, integer types, B1 implicit thresholds) reproduced.

## Domain-Specific Trace Check

The domain-specific trace table (§Domain-Specific Data Trace) contains five rows covering: AQI ranges, temperature ranges, no-medical-claims framing, distractor design, and Chinese display names. Every verifier-reading row cross-references the Verifier Integrity Trace. Distractor analysis correctly names the trap each eliminated city sets (temp upper-bound trap for 深圳, AQI trap for 成都, cold trap for 哈尔滨, near-miss comparison for 北京). Seed fixture actions and concrete field names are present in every row. Satisfies the ≥3-row minimum and concreteness rules.

## Verifier Integrity Check

- All three spec dimensions appear in Verifier Integrity Trace; weights sum to 1.0.
- verify.py skeleton correctly handles: missing file → 0.0/exit 1; integer type checks on `aqi` and `temp_high_c`; exact UTF-8 match on `city`; ±1 tolerance on `temp_high_c`; writes both reward.txt and reward.json; prints `Score: {reward}/1.0`; exits 1 if reward < 0.5.
- test.sh uses `set -e`, `/tests/verify.py` path (not `/workspace/tests/`), and `mkdir -p /logs/verifier`. Exit code propagation is correct.
- reward.json schema: `reward` key mandatory; string fields use `_meta_` prefix; `_meta_aqi_got` stores integer (acknowledged in R-02 as spec-mandated; harbour accepts int values). No ValidationError risk.
- Zero-work baseline is 0.0 with correct justification (file does not pre-exist).
- R-02 flag about `_meta_aqi_got` being integer under a `_meta_` prefix is identified and correctly resolved as a spec-defined behavior.

## Unresolved Issue Summary

**F-01 (CRITICAL)**: No build step adds the task to `docs/metadata/cases_registry.csv`. This file is (a) explicitly required by CLAUDE.md when adding new tasks and (b) cross-checked by `validate_annotations.py`, which the plan lists as a Step 3 acceptance criterion. The plan cannot pass its own validation without this step.
