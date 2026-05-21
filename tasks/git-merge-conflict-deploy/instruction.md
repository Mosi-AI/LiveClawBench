# Git Merge Conflict & Deploy

Your email inbox (http://localhost:5174/) contains a message from the Tech Lead explaining the context and requirements for code integration.

## Objective

The repository at `/workspace/webapp/` has multiple development branches that need to be merged into the mainline. The merges have conflicts — you need to understand the business intent of each branch, resolve all conflicts correctly, and ensure the merged code passes tests.

## Deliverables

1. All development branch changes correctly merged into the `main` branch
2. `npm test` passes after merging
3. Git history contains proper merge records
4. A merge resolution report at `/workspace/output/merge_report.md` that documents:
   - Which files contained merge conflicts
   - How each conflict was resolved
   - The rationale for each resolution decision, referencing the business intent of the involved branches
