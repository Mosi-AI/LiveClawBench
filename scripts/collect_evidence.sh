#!/usr/bin/env bash
# collect_evidence.sh — flatten harbor output into evidence-round{N}/{baseline,migrated}/
#
# Harbor writes trials at: <jobs_dir>/<timestamp>/<task>__<id>/
# generate-parity-table.py expects:  <evidence_root>/<side>/<task>__<id>/
#
# This script symlinks (non-destructive) all trial dirs found under one or more
# harbor jobs directories into the evidence layout the renderer consumes. The same
# evidence root may be populated from multiple jobs dirs (e.g., smoke + full runs).
#
# Usage:
#   collect_evidence.sh <evidence_root> <side> <jobs_dir> [<jobs_dir>...]
#
# Example:
#   collect_evidence.sh evidence-round10 baseline \
#     /path/to/main-baseline/jobs-baseline-round10
#   collect_evidence.sh evidence-round10 migrated ./jobs-migrated-round10

set -euo pipefail

if [ "$#" -lt 3 ]; then
    echo "Usage: $0 <evidence_root> <side: baseline|migrated> <jobs_dir> [<jobs_dir>...]" >&2
    exit 1
fi

evidence_root="$1"
side="$2"
shift 2

case "$side" in
    baseline|migrated) ;;
    *) echo "ERROR: side must be 'baseline' or 'migrated' (got '$side')" >&2; exit 1 ;;
esac

dest="$evidence_root/$side"
mkdir -p "$dest"

linked=0
skipped=0

for jobs_dir in "$@"; do
    if [ ! -d "$jobs_dir" ]; then
        echo "WARN: $jobs_dir is not a directory — skipping" >&2
        continue
    fi

    abs_jobs_dir="$(cd "$jobs_dir" && pwd -P)"

    # Find every dir at depth 1 or 2 with a verifier/reward.txt file inside.
    # That uniquely identifies a trial dir regardless of whether jobs_dir is
    # the timestamp wrapper or contains timestamp wrappers.
    while IFS= read -r reward; do
        trial="$(dirname "$(dirname "$reward")")"
        base="$(basename "$trial")"
        if [[ "$base" != *__* ]]; then
            continue
        fi
        if [ -e "$dest/$base" ]; then
            skipped=$((skipped+1))
            continue
        fi
        ln -s "$trial" "$dest/$base"
        linked=$((linked+1))
    done < <(find "$abs_jobs_dir" -mindepth 2 -maxdepth 4 -type f -name reward.txt -path '*/verifier/reward.txt')
done

echo "Linked $linked trials into $dest (skipped $skipped pre-existing)"
