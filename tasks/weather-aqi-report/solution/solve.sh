#!/usr/bin/env bash
# Reference solution: query the JSON API directly and write the result
set -euo pipefail

mkdir -p /workspace/output

AQI_JSON=$(curl -s http://localhost:3000/api/location/beijing/air-quality)
AQI=$(echo "$AQI_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['aqi'])")
CATEGORY=$(echo "$AQI_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(d['category'])")

python3 -c "
import json
result = {'city': '北京', 'aqi': $AQI, 'category': '$CATEGORY'}
with open('/workspace/output/aqi_report.json', 'w') as f:
    json.dump(result, f)
print('Written:', result)
"
