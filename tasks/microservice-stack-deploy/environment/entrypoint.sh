#!/usr/bin/env bash
set -e
/startup.sh &
exec "$@"
