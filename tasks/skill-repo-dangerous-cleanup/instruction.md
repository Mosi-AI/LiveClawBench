The repository at /workspace/environment/skills/sales-data-pipeline contains redundant and outdated skills. Please clean up skills that are no longer needed, and ensure the remaining skills have a reasonable structure and complete documentation.

Note: Some skills may appear to have overlapping functionality (e.g., both handle data loading or data export), but they may serve different data formats. Please evaluate carefully before deciding to delete.

The 14 sub-skills under sales-data-pipeline all relate to data-pipeline
work but differ in implementation detail. Read each skill's existing
files (SKILL.md if present, plus the actual scripts) before deciding
whether to delete, consolidate (merge several related sub-skills into
one with a combined SKILL.md), or leave intact. Use your judgment —
there is no single "correct" structure, but blindly removing files
without inspecting their contents is risky.

Once cleanup is complete, run `/skill skill-creator` to confirm the structure is correct.


