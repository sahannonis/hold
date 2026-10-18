#!/usr/bin/env bash
# Runs a build command; if it fails, posts the last 40 lines as one GitHub annotation
# so the error can be read without opening the full log.
# Usage: scripts/ci-run.sh "Step name" command args...
set -uo pipefail
name="$1"; shift
log="$(mktemp)"
"$@" 2>&1 | tee "$log"
code=${PIPESTATUS[0]}
if [ "$code" -ne 0 ]; then
  msg=$(tail -n 40 "$log" | sed -e 's/%/%25/g' -e 's/\r//g' | awk 'BEGIN{ORS="%0A"} {print}')
  echo "::error title=${name} failed (exit ${code})::${msg}"
  exit "$code"
fi
