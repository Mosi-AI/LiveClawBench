## Task Description

Your email inbox (http://localhost:5174/) contains a handover message from a former developer who left the codebase in a chaotic state.

## Objective

The codebase at `/workspace/codebase/` has been severely contaminated. Multiple types of damage have been introduced — you must discover, diagnose, and fix all issues to restore the project to a fully working state.

## Deliverables

1. **All tests pass**: `pytest` must exit with code 0 and **all** tests must pass (partial pass = no credit on the test dimension)
2. **Clean codebase**: All files that don't belong to the original project must be removed
3. **Working dependencies**: `pip install -e .` must succeed
4. **Restoration report** at `/workspace/output/restoration_report.md`