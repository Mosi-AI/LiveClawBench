#!/usr/bin/env bash
set -euxo pipefail

rm -rf /workspace/repo/citation_analyzer
cp -r /solution/reference/citation_analyzer /workspace/repo/citation_analyzer

python3 -c "from citation_analyzer import load_graph, pagerank, detect_cascades, yearly_top, write_outputs; print('imports OK')"
echo "Oracle: installed reference citation_analyzer/ implementation"
