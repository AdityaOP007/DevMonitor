#!/usr/bin/env bash
set -e
"$(dirname "$0")/../backend/scripts/smoke.sh" "$@"
