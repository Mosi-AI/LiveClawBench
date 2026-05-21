#!/bin/bash
set -e
/workspace/startup.sh &
exec "$@"
