#!/bin/bash
set -e

BASE="http://localhost:8400"
OUT="/workspace/policy_timeline.csv"

echo "Fetching release archive index..."
INDEX=$(curl -s "$BASE/")

# Extract the last 4 releases from the index: v4.3.0, v4.2.0, v4.1.0, v4.0.0
# The server lists 6 releases; we only want the last 4 (skip v3.9.0 and v3.8.0)
VERSIONS="v4.3.0 v4.2.0 v4.1.0 v4.0.0"

echo "date,version,change,source_url" > "$OUT"

for ver in $VERSIONS; do
  echo "Reading release notes for $ver..."
  PAGE=$(curl -s "$BASE/releases/$ver")

  # Extract text lines that look like policy changes (containing keywords):
  # data retention, cookie consent, rate limit, export, two-factor, password,
  # terms of service, privacy shield
  # We filter out product/UI changes like dashboard, dark mode, search, mobile app, etc.
  echo "$PAGE" | sed -n 's/.*<li>\(.*\)<\/li>.*/\1/p' | while IFS= read -r change; do
    lower=$(echo "$change" | tr '[:upper:]' '[:lower:]')
    if echo "$lower" | grep -qE 'data.retention|cookie.consent|rate.limit|export.policy|two.factor|password.policy|terms.of.service|privacy.shield'; then
      # Extract the release date from the meta line
      rdate=$(echo "$PAGE" | sed -n 's/.*Released: \([0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}\).*/\1/p')
      echo "$rdate,$ver,\"$change\",$BASE/releases/$ver" >> "$OUT"
    fi
  done
done

# Sort by date to ensure chronological order
head -n1 "$OUT" > /tmp/sorted.csv
tail -n +2 "$OUT" | sort >> /tmp/sorted.csv
mv /tmp/sorted.csv "$OUT"

echo "policy_timeline.csv written to /workspace/"
wc -l "$OUT"
