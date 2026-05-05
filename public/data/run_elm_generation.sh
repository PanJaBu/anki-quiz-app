#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${1:-$SCRIPT_DIR}"
if [[ $# -gt 0 ]]; then
  shift
fi
PARALLEL="${PARALLEL:-1}"
RETRIES="${RETRIES:-3}"
MODE="${MODE:-strict}"
MODEL="${MODEL:-openai/gpt-5.4}"
TIMEOUT="${TIMEOUT:-300}"
TIMEOUT_PER_QUESTION="${TIMEOUT_PER_QUESTION:-5}"

python3 "$ROOT/generate_elm_json.py" \
  --root "$ROOT" \
  --model "$MODEL" \
  --parallel "$PARALLEL" \
  --retries "$RETRIES" \
  --mode "$MODE" \
  --timeout "$TIMEOUT" \
  --timeout-per-question "$TIMEOUT_PER_QUESTION" \
  --resume \
  "$@"
