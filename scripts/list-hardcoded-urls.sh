#!/usr/bin/env bash
set -euo pipefail

ALLOWLIST_FILE="$(dirname "$0")/hardcoded-url-allowlist.txt"

matches=$(grep -R --line-number --exclude-dir=node_modules --exclude-dir=.git -E "http://localhost|localhost:5000" || true)
matches=$(echo "$matches" | grep -v 'scripts/list-hardcoded-urls.sh' || true)

if [[ -f "$ALLOWLIST_FILE" ]]; then
  matches=$(echo "$matches" | grep -F -v -f "$ALLOWLIST_FILE" || true)
fi

if [[ -n "$matches" ]]; then
  echo "$matches"
  echo "Hardcoded localhost URLs detected."
  exit 1
else
  echo "No hardcoded localhost URLs found."
  exit 0
fi
