#!/usr/bin/env bash
# Oracle solution: replace skeleton ga_solver with reference impl.
set -euxo pipefail

rm -rf /workspace/repo/ga_solver
cp -r /solution/reference/ga_solver /workspace/repo/ga_solver

python3 -c "from ga_solver import Problem, GASolver; print('imports OK')"
echo "Oracle: installed reference ga_solver/ implementation"
