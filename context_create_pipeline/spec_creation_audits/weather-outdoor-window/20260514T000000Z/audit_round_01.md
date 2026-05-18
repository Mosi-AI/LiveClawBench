# Audit Round 1: weather-outdoor-window

STATUS: FAIL

## Summary

The spec is well-structured, technically accurate against the mock snapshot, and the verifier design aligns precisely with the CSV scoring criteria. It fails on two issues: the instruction draft materially diverges from the CSV row's `instruction` field by silently removing the two explicit filtering constraints (temp 10–28°C, precip_mm = 0) to implement B1=1 implicitly; and the Task Goal section partially names those same implicit criteria in violation of the no-thresholds-in-Task-Goal rule.

## Findings

| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| F-01 | MEDIUM | "Audit against CSV row; B1=1: implicit-goal tasks expose natural user intent, not all verifier predicates" | §3 Agent Instruction Draft | CSV `instruction` field explicitly states: "find the longest continuous block of hours where: (1) the temperature is between 10°C and 28°C, AND (2) there is no precipitation (precip_mm = 0)". Spec instruction silently replaces this with "identify the longest continuous block of time that's suitable for running outdoors" — omitting both constraints without flagging the deviation. The B1=1 factor and the explicit CSV instruction are mutually contradictory; the spec resolves the contradiction unilaterally in one direction. | Either (a) adopt the CSV instruction verbatim and downgrade B1 to 0, or (b) document explicitly that the CSV instruction text is superseded by the B1=1 factor intent and confirm the implicit wording is authoritative. The current spec neither matches the CSV text nor explains the deviation. | OPEN |
| F-02 | LOW | "No scoring rules, correct answers, verifier file names, or thresholds in Task Goal or Instruction" | §2 Task Goal | "infer what conditions make an outdoor run suitable **(no precipitation, comfortable temperature)**" — for a B1=1 task, the Task Goal section names the specific constraint dimensions the agent is expected to derive independently. "No precipitation" is a statement of the precipitation threshold (precip_mm = 0). | Rephrase to state design intent without naming constraint dimensions, e.g. "…infer appropriate outdoor-exercise conditions from domain knowledge and the visible forecast columns." | OPEN |

## Previous Round Verification

Not applicable.

## Metadata Check

All required metadata fields are present and consistent with the CSV row: `task_name` is kebab-case, `case_id = 111`, `ability_category`, `domain`, `domains_multi`, `factors`, and `registry_description` all match exactly. `task.toml` block is complete: correct difficulty (`hard`), factors (A1=0, A2=0, B1=1, B2=0), `allow_internet = true`, no deprecated `capability_dimension`. Tags are snake_case and domain-aligned. `domains_multi[0]` matches `domain`. PASS on all metadata points.

## Instruction Leakage Check

The spec's instruction draft does not leak scoring rules, correct answers, verifier filenames, or numerical thresholds — the implicit phrasing ("suitable for running outdoors") is clean on that axis. URL format includes "open it in your browser" per checklist. Instruction is well over 100 characters and reads as a natural user request. Linux container paths only. However, the instruction's divergence from the CSV row text is the primary FAIL trigger (F-01 above). Section 5 (Expected Behavior / Reference Path) and Section 8 (Implementation Notes) correctly expose internal ground-truth details for implementers, not the agent, which is appropriate.

## Environment And Verifier Check

Mock service port (3000) is consistent throughout. Dockerfile base `liveclawbench-weather-outdoor-window-base:latest` follows CLAUDE.md per-task layer convention. `task-binary-map.json` addition requirement for the `weather` binary is correctly noted. Output path `/workspace/output/exercise_window.json` is a Linux container path; directory pre-exists per base image. Verifier dimensions and weights (0.4 + 0.4 + 0.2 = 1.0) match CSV exactly. `reward.json` fields are all `float | int`; no string values; no `_meta_` prefix needed. Zero-work baseline is 0.0. `Score: X.X/1.0` format and exit-nonzero-if-below-0.5 are both specified. All PASS.

## Unresolved Issue Summary

- **F-01 (MEDIUM)**: Spec instruction silently removes explicit CSV constraints (temp 10–28°C, precip_mm = 0) to implement B1=1; deviation from CSV `instruction` field is unexplained and unresolved.
- **F-02 (LOW)**: Task Goal names "no precipitation, comfortable temperature" — partially reveals threshold dimensions for a B1=1 implicit-goal task in violation of no-thresholds-in-Task-Goal rule.
