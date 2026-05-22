#!/usr/bin/env bash
# Oracle solution for swe-pro-element-web-unverified-device-stripped.
#
# Applies the upstream gold patch (the diff between base-commit and gold-fix-commit
# tagged inside the Docker image during environment/Dockerfile build).
#
# Invoked only when running `harbor run --agent oracle`. Never runs during normal
# evaluation with `-a openclaw`.

set -euxo pipefail

cd /workspace/repo

# Reset to base in case prior agent runs left changes.
git reset --hard base-commit
git clean -fd

# Apply the upstream fix as a working-tree diff so HEAD stays at base-commit —
# the verifier's `git diff base-commit` introspection then sees the agent-style
# diff form rather than a merge commit.
git diff base-commit gold-fix-commit | git apply --index

echo "Oracle: applied upstream fix from gold-fix-commit"
