# Skill Repository Consolidation

The directory `/workspace/environment/skills/sales-data-pipeline` is a
fragmented knowledge base: **14 sub-skills** with substantial overlap and
redundancy. Use the `skill-creator` skill to clean it up.

## Your Goal

Consolidate the 14 sub-skills into a smaller set of **4–6 cohesive
sub-skills** that together cover the full data-pipeline lifecycle —
ingestion, cleaning, validation, transformation, aggregation/reporting,
and export. Eliminate overlapping or redundant skills; preserve every
distinct capability of the originals.

## Deliverables

1. **Consolidated skill directory** at
   `/workspace/environment/skills/sales-data-pipeline/` — replace the 14
   original sub-skills with 4–6 well-named sub-skills, each carrying its
   own well-formed `SKILL.md`.

2. **Consolidation rationale** at
   `/workspace/environment/skills/sales-data-pipeline/CONSOLIDATION_RATIONALE.md`
   — a written record of:
   - Which original sub-skills were merged, and into what.
   - Why each merge made sense (overlap, redundancy, subset/superset, etc.).
   - How coverage of the original capabilities is preserved.

   This file is **scored**: the verifier uses it to determine whether you
   identified redundancy pairs and articulated a clear merge rationale.

## Scoring Dimensions (each contributes to total / 100)

| Dimension | Weight | Source |
|---|---|---|
| Redundancy identified | 15 | `CONSOLIDATION_RATIONALE.md` + your reasoning trace |
| Coverage preserved | 20 | union of consolidated `SKILL.md` files |
| Skill count reduced | 15 | count of sub-skills (target 4–6) |
| Overlap eliminated | 15 | Jaccard similarity across consolidated skills |
| Pipeline coherent | 15 | stage coverage (ingestion, cleaning, validation, transformation, aggregation, export) |
| Skill quality | 10 | each `SKILL.md` well-formed |
| Consolidation rationale | 10 | `CONSOLIDATION_RATIONALE.md` + your reasoning trace |

Aim for ≥80/100.
