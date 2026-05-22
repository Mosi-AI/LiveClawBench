#!/usr/bin/env bash
# Oracle solution for swe-pro-openlibrary-3rd-metadata-source-stripped.
set -euxo pipefail

cd /workspace/repo

git reset --hard base-commit
git clean -fd

git diff base-commit gold-fix-commit | git apply --index

echo "Oracle: applied upstream fix from gold-fix-commit"
