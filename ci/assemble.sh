#!/usr/bin/env bash
# Stage 3. Assemble the public site into dist/, once. The container image and
# Cloudflare Pages both receive exactly these files.
set -euo pipefail

commit="${GITHUB_SHA:-$(git rev-parse HEAD 2> /dev/null || echo local)}"

# api/*.json is the source of truth; regenerate the flattened copy.
node build.mjs

# Publish only the site: not build.mjs, server.mjs, the README, the CV, and so on.
rm -rf dist
mkdir -p dist
cp index.html llms.txt llms-full.txt robots.txt sitemap.xml _headers favicon.ico dist/
cp -r assets api .well-known dist/

# A build stamp, so anyone can ask a running copy of the site which commit it is.
printf '{"commit":"%s","built_at":"%s"}\n' "$commit" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > dist/build.json

echo "Assembled dist/ for commit ${commit}:"
find dist -type f | sort
