#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -x "$ROOT_DIR/start-dev.sh" ]]; then
  printf '[ClauseWise] ERROR: start-dev.sh is missing or not executable\n' >&2
  exit 1
fi

exec "$ROOT_DIR/start-dev.sh" "$@"
