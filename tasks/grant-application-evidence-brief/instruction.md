We are preparing a grant application. Please review the draft materials in `corpus/` (available at `~/.openclaw/corpus/`) and update the research evidence brief.

There is an older draft brief already in the corpus. Your task is to **update it incrementally** — correct any outdated claims based on the latest materials, and fill in any gaps. Do not simply rewrite it from scratch; preserve still-valid content and make precise corrections where the evidence has changed.

The updated brief should cover:
1. **Project objective** — what the project aims to achieve
2. **Prior evidence or supporting results** — at least 3 specific pieces of evidence from the corpus (cite the source file for each)
3. **Novelty or differentiation** — what distinguishes this project from prior work (use the latest characterisation, not the one in the old draft if it has been superseded)
4. **Evidence gaps** — at least 2 areas where supporting evidence is still missing or weak
5. **Suggested next steps** — concrete actions before submission

Save the result to `~/.openclaw/output/result.json` with these fields:
- `"project_objective"` — string
- `"supporting_evidence"` — list of strings, each citing a specific result and its source file (minimum 3)
- `"novelty"` — string describing the project's differentiation (must reflect the latest understanding from the corpus)
- `"evidence_gaps"` — list of strings (minimum 2)
- `"next_steps"` — list of strings
- `"corrections"` — list of strings, each describing one outdated claim from the draft and what it was corrected to (minimum 1; document every significant change you make)
