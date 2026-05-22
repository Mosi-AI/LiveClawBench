#!/usr/bin/env bash
set -euxo pipefail

rm -rf /workspace/repo/gol_evolver
cp -r /solution/reference/gol_evolver /workspace/repo/gol_evolver

python3 -c "from gol_evolver import GoL, StructureDetector, Evolver; print('imports OK')"
echo "Oracle: installed reference gol_evolver/ implementation"
