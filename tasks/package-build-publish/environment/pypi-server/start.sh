#!/usr/bin/env bash
# Start the PyPI server
exec pypiserver run -p 8080 -a . -P . /workspace/pypi-server/packages/
