#!/bin/bash
# R11C Evidence Preparation: Merge R10 baseline + R10 migrated + R11A patch + R11B noise
# into evidence-round11/ for final parity-table generation.
#
# Data sources:
#   Baseline:  main-baseline/jobs-baseline-round10/ (30 tasks × 3 attempts)
#              + jobs-round11-noise/ (13 mock-independent × 3 attempts)
#   Migrated:  jobs-migrated-round10/ (30 tasks × 3 attempts)
#              + R11A v2 from jobs-migrated-round11-patch/ (9 patched tasks × 3 attempts)
#              + jobs-round11-noise/ (13 mock-independent × 3 attempts)
#
# Overlay rules:
#   - R11A v2 data OVERWRITES R10 migrated for the 9 patched email-app tasks
#   - R11B noise data is ADDED to both sides for the 13 mock-independent tasks
#   - All other tasks inherit R10 data unchanged

set -euo pipefail

cd /Users/swordfaith/Documents/workspace/ClawBench/LiveClawBench/.claude/worktrees/plan3-spec-refine

BASE="/Users/swordfaith/Documents/workspace/ClawBench/LiveClawBench/.claude/worktrees/main-baseline/jobs-baseline-round10"
MIG_R10="jobs-migrated-round10"
MIG_R11A="jobs-migrated-round11-patch"
NOISE="jobs-round11-noise"
OUT="evidence-round11"

# Tasks whose migrated data should be overwritten by R11A v2
R11A_PATCH_TASKS=(
  email-reply email-writing email-washer-change email-watch-shop
  schedule-change-request flight-cancel-claim flight-info-change-notice
  flight-seat-selection flight-seat-selection-failed
)

# Mock-independent tasks that get R11B noise data added
NOISE_TASKS=(
  blog-site-from-scratch blog-site-completion-from-starter
  vue-build-fix-single vue-build-fix-chain
  skill-creation skill-repository-curation skill-supplementation
  skill-conflict-resolution skill-dependency-fix skill-combination
  noise-filtering incremental-update-ctp live-web-research-sqlite-fts5
)

echo "=== R11C Evidence Preparation ==="
echo "Output: $OUT/"

# Clean and create output structure
rm -rf "$OUT"
mkdir -p "$OUT/baseline" "$OUT/migrated"

# ---------------------------------------------------------------------------
# Baseline side: R10 + R11B noise
# ---------------------------------------------------------------------------
echo "Copying baseline R10 data..."
if [ -d "$BASE" ]; then
  for src in "$BASE"/*/*__/; do
    [ -d "$src" ] || continue
    task=$(basename "$src" | sed 's/__.*//')
    dest="$OUT/baseline/$(basename "$src")"
    cp -r "$src" "$dest"
  done
else
  echo "WARNING: $BASE not found"
fi

echo "Adding R11B noise to baseline side..."
if [ -d "$NOISE" ]; then
  for src in "$NOISE"/*/*__/; do
    [ -d "$src" ] || continue
    task=$(basename "$src" | sed 's/__.*//')
    if printf '%s\n' "${NOISE_TASKS[@]}" | grep -qx "$task"; then
      dest="$OUT/baseline/$(basename "$src")"
      cp -r "$src" "$dest"
    fi
  done
else
  echo "WARNING: $NOISE not found (R11B may still be running)"
fi

# ---------------------------------------------------------------------------
# Migrated side: R10 + R11A patch overlay + R11B noise
# ---------------------------------------------------------------------------
echo "Copying migrated R10 data..."
if [ -d "$MIG_R10" ]; then
  for src in "$MIG_R10"/*/*__/; do
    [ -d "$src" ] || continue
    task=$(basename "$src" | sed 's/__.*//')
    dest="$OUT/migrated/$(basename "$src")"
    cp -r "$src" "$dest"
  done
else
  echo "WARNING: $MIG_R10 not found"
fi

echo "Overlaying R11A patch data..."
if [ -d "$MIG_R11A" ]; then
  for src in "$MIG_R11A"/*/*__/; do
    [ -d "$src" ] || continue
    task=$(basename "$src" | sed 's/__.*//')
    if printf '%s\n' "${R11A_PATCH_TASKS[@]}" | grep -qx "$task"; then
      # Remove old R10 data for this task (all instances)
      rm -rf "$OUT/migrated/${task}"__*
      dest="$OUT/migrated/$(basename "$src")"
      cp -r "$src" "$dest"
    fi
  done
else
  echo "WARNING: $MIG_R11A not found"
fi

echo "Adding R11B noise to migrated side..."
if [ -d "$NOISE" ]; then
  for src in "$NOISE"/*/*__/; do
    [ -d "$src" ] || continue
    task=$(basename "$src" | sed 's/__.*//')
    if printf '%s\n' "${NOISE_TASKS[@]}" | grep -qx "$task"; then
      dest="$OUT/migrated/$(basename "$src")"
      cp -r "$src" "$dest"
    fi
  done
fi

# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------
echo ""
echo "=== Verification ==="
baseline_count=$(find "$OUT/baseline" -name "reward.txt" | wc -l | tr -d ' ')
migrated_count=$(find "$OUT/migrated" -name "reward.txt" | wc -l | tr -d ' ')
echo "Baseline trials:  $baseline_count"
echo "Migrated trials:  $migrated_count"

# Check trial counts per task
echo ""
echo "Per-task trial counts:"
python3 -c "
import glob, os
from collections import Counter

for side in ['baseline', 'migrated']:
    counts = Counter()
    for f in glob.glob(f'$OUT/{side}/*__*/verifier/reward.txt'):
        task = os.path.basename(os.path.dirname(os.path.dirname(f))).split('__')[0]
        counts[task] += 1
    print(f'{side}:')
    for t, n in sorted(counts.items()):
        print(f'  {t}: {n}')
"

echo ""
echo "=== R11C evidence ready at $OUT/ ==="
