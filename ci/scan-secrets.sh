#!/usr/bin/env bash
# Stage 2 · Scan code. Look for secrets in the commits this pipeline run introduces.
set -euo pipefail

# A pinned Gitleaks release, verified by checksum before it is allowed to run.
VERSION="8.30.1"
SHA256="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb"

tools="$(mktemp -d)"
curl --fail --silent --show-error --location \
  --output "$tools/gitleaks.tar.gz" \
  "https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_linux_x64.tar.gz"
echo "${SHA256}  ${tools}/gitleaks.tar.gz" | sha256sum --check --quiet
tar -xzf "$tools/gitleaks.tar.gz" -C "$tools" gitleaks

# Work out which commits are new.
no_commit="0000000000000000000000000000000000000000"
range=""
if [ -n "${PR_BASE_SHA:-}" ] && [ -n "${PR_HEAD_SHA:-}" ]; then
  range="${PR_BASE_SHA}..${PR_HEAD_SHA}"
elif [ -n "${PUSH_BEFORE_SHA:-}" ] && [ "$PUSH_BEFORE_SHA" != "$no_commit" ] &&
  git cat-file -e "${PUSH_BEFORE_SHA}^{commit}" 2>/dev/null; then
  range="${PUSH_BEFORE_SHA}..${GITHUB_SHA}"
fi

if [ -n "$range" ]; then
  echo "Scanning the new commits: ${range}"
  "$tools/gitleaks" git --no-banner --redact --verbose --log-opts="$range" .
else
  # First push, or history was rewritten: check the files as they are now.
  echo "No commit range for this run, scanning the current files"
  "$tools/gitleaks" dir --no-banner --redact --verbose .
fi
