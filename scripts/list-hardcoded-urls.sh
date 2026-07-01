#!/usr/bin/env bash
set -euo pipefail

# Flag hardcoded localhost URLs in SHIPPING RUNTIME SOURCE only — where such a URL
# is a real production bug. Deliberately out of scope (localhost is legitimate there):
#   - dev tooling and smoke tests (scripts/, **/__tests__)
#   - documentation (docs/, *.md)
#   - local infra (infra/, docker-compose*, nginx*.conf, Dockerfile, .env.example)
#   - env-driven fallbacks: `process.env.X || 'http://localhost:5000'`
# Remaining intentional cases are listed in hardcoded-url-allowlist.txt.

ALLOWLIST_FILE="$(dirname "$0")/hardcoded-url-allowlist.txt"

matches=$(grep -R --line-number \
  --include='*.js' --include='*.ts' --include='*.jsx' --include='*.tsx' \
  --exclude-dir=node_modules --exclude-dir=.git \
  --exclude-dir=__tests__ --exclude-dir=tests --exclude-dir=test \
  --exclude-dir=scripts --exclude-dir=docs --exclude-dir=infra --exclude-dir=monitoring \
  -E "http://localhost|localhost:5000" backend frontend 2>/dev/null || true)

# Env-driven fallbacks are the correct pattern, not a hardcoded URL.
matches=$(echo "$matches" | grep -v 'process\.env' || true)

if [[ -f "$ALLOWLIST_FILE" ]]; then
  matches=$(echo "$matches" | grep -F -v -f "$ALLOWLIST_FILE" || true)
fi

# Drop any blank lines left by the filters above.
matches=$(echo "$matches" | grep -v '^[[:space:]]*$' || true)

if [[ -n "$matches" ]]; then
  echo "$matches"
  echo "Hardcoded localhost URLs detected in shipping source."
  exit 1
else
  echo "No hardcoded localhost URLs found in shipping source."
  exit 0
fi
