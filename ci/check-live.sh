#!/usr/bin/env bash
# Ask a running copy of the site which commit it is, and wait until it is the one we built.
# Usage: bash ci/check-live.sh <base URL>
set -euo pipefail

url="${1:?Pass the site URL}"
: "${GITHUB_SHA:?}"

echo "Checking ${url}"
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if live="$(curl --fail --silent --location --max-time 5 "${url%/}/build.json" | jq -r '.commit')" &&
    [ "$live" = "$GITHUB_SHA" ]; then
    echo "Live commit: ${live}"
    exit 0
  fi
  echo "Attempt ${attempt}: not serving ${GITHUB_SHA} yet"
  sleep 5
done
echo "${url} is not serving commit ${GITHUB_SHA}" >&2
exit 1
