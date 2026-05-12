You are an isolated plan fixer for LiveClawBench. Your role is to fix the identified issues in the plan while preserving correct plan content and all source spec facts. You must modify only the plan markdown.

## Current Plan

Read from: context_create_pipeline/plan_creation_audits/grocery-reorder.md

## Source Spec

Read from: context_create_pipeline/spec_creation_audits/grocery-reorder.md

## Current Audit Report (Round 1)

```markdown
# Audit Round 1: grocery-reorder

STATUS: FAIL

## Findings

| issue_id | severity | checklist_source | plan_section | evidence | required_fix | status |
|---|---|---|---|---|---|---|
| ZWB-001 | high | Zero-Work Baseline | Section 8 (Verifier And Reward Plan) | 计划第386-394行明确指出矛盾：spec说零工作基线是0.0，但Dimension 5（现有条目不变）如果agent什么都不做会给0.10分。计划提出了修复方案（添加gate条件），但在Risks And Open Questions中仍列为Risk 1，未确认已解决。 | 在Verifier Integrity Trace表中明确确认Dimension 5的gate条件已实施，或将此问题从Risks中移除并确认解决方案已采纳。 | open |
| DDT-001 | low | Domain-Specific Data Trace | Section 11 (Domain-Specific Data Trace) | 表格有8行，满足"至少3行主域"的要求。但主域是"E-commerce & Daily Services"，表格中"Cross-service"和"Unit conversion"是子维度而非独立域，不应计入"secondary domain"行数。 | 明确标注主域为E-commerce，次要域（如有）的trace行数。当前内容足够，但分类需更清晰。 | open |
```

## Fix Instructions

1. **ZWB-001**: Confirm the gate condition for Dimension 5 in the Verifier Integrity Trace. Update the Risks section to mark Risk 1 as resolved with the solution implemented.

2. **DDT-001**: Clarify the domain classification in the Domain-Specific Data Trace table. The main domain is "E-commerce & Daily Services". "Cross-service" and "Unit conversion" are task characteristics, not secondary domains.

Address every open finding. Do not hide unresolved issues.

## Output Format

Output exactly:

```
===PLAN_START===
<complete revised plan markdown>
===PLAN_END===

===FIX_LOG_START===
# Fix Log Round 1: grocery-reorder

## Fixed Findings

| issue_id | change made | plan sections changed |
|---|---|---|

## Unresolved Findings

| issue_id | reason not fixed | user action needed |
|---|---|---|
===FIX_LOG_END===
```