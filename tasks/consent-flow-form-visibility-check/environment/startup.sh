#!/bin/bash
python3 /workspace/environment/consent_server.py &
i=0
while [ $i -lt 30 ]; do
  curl -sf http://localhost:8500/health && break
  sleep 1
  i=$((i+1))
done
