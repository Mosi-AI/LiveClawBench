#!/bin/bash
set -e

curl -s -X POST http://localhost:5003/api/store/packs/1/acquire
curl -s -X POST http://localhost:5003/api/store/packs/2/acquire

echo "Packs acquired."
