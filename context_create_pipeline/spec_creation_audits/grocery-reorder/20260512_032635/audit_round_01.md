# Audit Round 1: grocery-reorder

STATUS: FAIL

## Summary
The spec is well-structured but has several critical issues: (1) inconsistent terminology between "Shopping List" and "Requirements List" across sections, (2) missing explicit verifier state paths for both databases, (3) missing `case_id` value, and (4) the `xc` field in raw collection sheet shows "Health & Wellness" but `source_domain` shows "E-commerce & Daily Services" without explanation.

## Findings
| issue_id | severity | checklist_source | spec_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| 001 | high | Structure And Metadata | Case Metadata | `case_id = "TODO"` - no value assigned | Assign actual case_id from `docs/metadata/cases_registry.csv` | open |
| 002 | medium | Environment And Data Completeness | 4. Environment And Data Setup | Verifier-readable symlink path mentioned for smarthome (`/tmp/mosi_smart_home.sqlite`) but not for shop database | Add explicit verifier-readable symlink path for shop database | open |
| 003 | medium | Environment And Data Completeness | 4. Environment And Data Setup, 6. Verifier Design | Section 4 mentions `smarthome_seed.sql` and `shop_seed.sql` but Section 6 Verifier Design does not show the actual SQL schema for shop orders table (only mentions it in text) | Provide complete SQL schema for both databases in verifier design | open |
| 004 | low | Structure And Metadata | Case Metadata, Raw Collection Sheet Fields | `xc` field shows "Health & Wellness" but `source_domain` shows "E-commerce & Daily Services" - inconsistency not explained | Either align values or add note explaining the discrepancy | open |
| 005 | low | Environment And Data Completeness | 4. Environment And Data Setup | `task-binary-map.json` entry shows `"dest": "/opt/mock/data/smarthome.sql"` but startup section mentions `/opt/mock/startup.d/grocery-reorder.sh` - no explanation of how SQL files are loaded into databases | Clarify the data loading mechanism or add startup script content | open |
| 006 | low | Verifier Contract | 6. Verifier Design | Dimension 4 (Agent response explains rounding decision) has "Partial credit" in failure policy but no explicit partial credit breakdown | Define explicit partial credit rules (e.g., 0.05 for mentioning 2.5 dozen, 0.10 for explaining rounding) | open |

## Previous Round Verification
Not applicable.

## Metadata Check
- `task_name`: `grocery-reorder` ✓ (kebab-case, matches expected)
- `case_id`: Missing (TODO placeholder) ✗
- `domains_multi[0]` matches `domain`: ✓ (both "E-commerce & Daily Services")
- Tags align with domains: ✓
- Factor fields (A1/A2/B1/B2): ✓
- No deprecated `capability_dimension`: ✓
- Suggested `task.toml` includes all required fields: ✓

## Instruction Leakage Check
- `Task Goal` describes user-visible objective only: ✓
- No scoring rules, correct answers, hidden state, verifier file names revealed: ✓
- No `Score`, `reward`, `checkpoint`, `pass/fail` language: ✓
- Instruction is natural user request: ✓
- URLs use `http://localhost:<port>/` with "open it in browser": ✓
- Paths are Linux container paths: ✓

## Environment And Verifier Check
- Dockerfile base is `liveclawbench-base:latest`: ✓
- Both mock services specified with ports: ✓
- `entrypoint.sh` ends with `exec "$@"`: ✓
- `allow_internet = true`: ✓
- Verifier design covers all scoring points: ✓
- Reward normalized to 0.0-1.0: ✓
- Zero-work baseline is 0.0: ✓
- Missing explicit verifier state paths for shop database: ✗
- Missing SQL schema details in verifier design: ✗

## Unresolved Issue Summary
1. **High**: Assign actual `case_id` from `docs/metadata/cases_registry.csv`
2. **Medium**: Add explicit verifier-readable path for shop database
3. **Medium**: Provide complete SQL schema for both databases in verifier design section
4. **Low**: Explain or resolve `xc` vs `source_domain` discrepancy
5. **Low**: Clarify SQL file loading mechanism in startup
6. **Low**: Define explicit partial credit rules for keyword matching dimension
