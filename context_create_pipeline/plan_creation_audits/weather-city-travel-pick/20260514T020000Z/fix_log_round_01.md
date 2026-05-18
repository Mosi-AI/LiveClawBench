# Fix Log Round 1: weather-city-travel-pick

## Fixed Findings

| issue_id | change made | plan sections changed |
|---|---|---|
| F-01 | Added **Step 2: Add cases_registry.csv row** with the exact CSV row to append, acceptance checks (`grep` + `validate_annotations.py`), and `depends_on: none`. Renumbered former Steps 2–8 to Steps 3–9 and updated all `Depends on:` references accordingly (e.g. old "Step 2" → "Step 3", old "Steps 3–7" → "Steps 4–8"). Added `docs/metadata/cases_registry.csv` row to **§3 Source Assets And Reuse Map**. | §3 Source Assets And Reuse Map; §4 Step-By-Step Build Plan (all step numbers) |

## Unresolved Findings

| issue_id | reason not fixed | user action needed |
|---|---|---|
| — | — | — |
