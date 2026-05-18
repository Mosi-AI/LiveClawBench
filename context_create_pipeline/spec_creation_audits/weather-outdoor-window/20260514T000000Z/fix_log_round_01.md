# Fix Log Round 1: weather-outdoor-window

## Fixed Findings

| issue_id | change made | spec sections changed |
|---|---|---|
| F-01 | Added a note at the end of §8 explicitly documenting that the CSV `instruction` field contains explicit thresholds conflicting with B1=1; states that `factors` column is authoritative and the resolution matches weather-city-travel-pick (case 110); notes CSV field should be updated on next registry regeneration. | §8 |
| F-02 | Removed named constraint dimensions "(no precipitation, comfortable temperature)" from §2 Task Goal; replaced with "infer appropriate outdoor-exercise conditions from domain knowledge and the visible forecast columns" to avoid revealing the implicit goal dimensions. | §2 |

## Unresolved Findings

| issue_id | reason not fixed | user action needed |
|---|---|---|
| — | — | — |
