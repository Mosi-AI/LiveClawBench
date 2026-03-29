#!/usr/bin/env bash
# ============================================================================
# Apply bottom-level skill modifications for sh_case5 benchmark.
#
# This script simulates a developer manually updating 3 bottom-level skills:
#   1. csv-parser:        Add pipe/semicolon delimiters, quote-char, comment-prefix
#   2. column-calculator: Remove 'ratio', add percentage/cumulative_sum/rank
#   3. stats-aggregator:  Add percentile/mode metrics, add metadata to output
#
# After running this, the upper-level SKILL.md files will be out of sync.
# The model's task is to detect and fix the inconsistencies.
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PATCHES_DIR="$SCRIPT_DIR"
SKILLS_DIR="$BASE_DIR/environment/skills/report-generator-pipeline"

echo "=========================================="
echo "  Applying bottom-level skill patches"
echo "=========================================="

# --- Patch 1: csv-parser ---
echo "[1/3] Patching csv-parser ..."
cp "$PATCHES_DIR/patched_csv_parser_SKILL.md" \
   "$SKILLS_DIR/data-loader/csv-parser/SKILL.md"
cp "$PATCHES_DIR/patched_csv_parser.py" \
   "$SKILLS_DIR/data-loader/csv-parser/parser.py"
echo "  ✓ csv-parser updated (v1.0.0 → v1.1.0)"

# --- Patch 2: column-calculator ---
echo "[2/3] Patching column-calculator ..."
cp "$PATCHES_DIR/patched_column_calculator_SKILL.md" \
   "$SKILLS_DIR/data-transformer/column-calculator/SKILL.md"
cp "$PATCHES_DIR/patched_column_calculator.py" \
   "$SKILLS_DIR/data-transformer/column-calculator/calculator.py"
echo "  ✓ column-calculator updated (v1.0.0 → v1.1.0)"

# --- Patch 3: stats-aggregator ---
echo "[3/3] Patching stats-aggregator ..."
cp "$PATCHES_DIR/patched_stats_aggregator_SKILL.md" \
   "$SKILLS_DIR/report-renderer/stats-aggregator/SKILL.md"
cp "$PATCHES_DIR/patched_stats_aggregator.py" \
   "$SKILLS_DIR/report-renderer/stats-aggregator/aggregator.py"
echo "  ✓ stats-aggregator updated (v1.0.0 → v1.1.0)"

echo ""
echo "=========================================="
echo "  All patches applied successfully."
echo ""
echo "  The following upper-level SKILL.md files"
echo "  are now OUT OF SYNC and need updating:"
echo ""
echo "    - data-loader/SKILL.md"
echo "    - data-transformer/SKILL.md"
echo "    - report-renderer/SKILL.md"
echo "    - report-generator-pipeline/SKILL.md (top-level)"
echo "=========================================="
