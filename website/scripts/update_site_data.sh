#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# update_site_data.sh
#
# Regenerates website/site-data/ and website/public/diagrams/ from:
#   - worktree tasks + docs  (tasks.json, metrics-summary.json, domains.toml, mock-apps.json)
#   - traj_validation analysis outputs (leaderboard.json, diagrams)
#
# Excluded (not updated by this script):
#   trajectory-distribution.json, task-results.json, raw-rows.json, representative-cases.json
#
# Usage:
#   bash website/scripts/update_site_data.sh
#   WORKTREE=path/to/worktree ANALYSIS_ROOT=path/to/analysis bash website/scripts/update_site_data.sh
# ──────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$WEBSITE_ROOT/.." && pwd)"

# Configurable paths
WORKTREE="${WORKTREE:-$REPO_ROOT/.worktrees/fix-difficulty-recalibration}"
ANALYSIS_ROOT="${ANALYSIS_ROOT:-$REPO_ROOT/traj_validation/analysis_outputs/v0.2.0}"
SITE_DATA="$WEBSITE_ROOT/site-data"
PUBLIC_DIAGRAMS="$WEBSITE_ROOT/public/diagrams"

PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "$PYTHON_BIN" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
  elif command -v python >/dev/null 2>&1; then
    PYTHON_BIN="python"
  else
    echo "No python executable found. Set PYTHON_BIN=/path/to/python." >&2
    exit 1
  fi
fi

echo "[update_site_data] worktree=$WORKTREE"
echo "[update_site_data] analysis_root=$ANALYSIS_ROOT"
echo "[update_site_data] site_data=$SITE_DATA"
echo "[update_site_data] public_diagrams=$PUBLIC_DIAGRAMS"
echo "[update_site_data] python=$PYTHON_BIN"
echo ""

# ── Step 1: Generate tasks.json, metrics-summary.json, domains.toml, mock-apps.json ──
echo "═══ Step 1: Generating tasks.json, metrics-summary.json, domains.toml, mock-apps.json ═══"
"$PYTHON_BIN" "$SCRIPT_DIR/generate_site_data.py" \
  --worktree "$WORKTREE" \
  --output "$SITE_DATA"

# ── Step 2: Generate leaderboard.json from analysis tables ──
echo ""
echo "═══ Step 2: Generating leaderboard.json from analysis tables ═══"
"$PYTHON_BIN" "$SCRIPT_DIR/generate_leaderboard.py" \
  --analysis-root "$ANALYSIS_ROOT" \
  --output "$SITE_DATA/leaderboard.json"

# ── Step 3: Copy diagram figures ──
echo ""
echo "═══ Step 3: Updating public/diagrams/ ═══"
FIGURES_DIR="$ANALYSIS_ROOT/figures"
if [[ -d "$FIGURES_DIR" ]]; then
  for fig in factor_behavior_frontier.png factor_delta.png size_scaling.png; do
    src="$FIGURES_DIR/$fig"
    if [[ -f "$src" ]]; then
      cp "$src" "$PUBLIC_DIAGRAMS/$fig"
      echo "  copied $fig"
    else
      echo "  ⚠️  $fig not found in $FIGURES_DIR"
    fi
  done
else
  echo "  ⚠️  Figures directory not found: $FIGURES_DIR"
fi

echo ""
echo "[update_site_data] done"
