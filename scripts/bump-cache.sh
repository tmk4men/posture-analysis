#!/usr/bin/env bash
# Bump the cache-buster ?v=... on CSS/JS references in app.html and index.html.
#
# Why: GitHub Pages serves static assets with ~10-minute browser cache, so
# returning users may see stale JS/CSS after a deploy. Bumping the query
# string on every release forces the browser to fetch fresh files.
#
# Usage: ./scripts/bump-cache.sh  (run before `git commit && git push`)
#
# The version is a UTC timestamp (YYYYMMDD-HHMM). It propagates through
# ES module imports because main.js reads its own ?v= from import.meta.url
# and appends it to every dynamic import call.

set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(date -u +%Y%m%d-%H%M)"
echo "Bumping cache version to v=${VERSION}"

# Replace any existing ?v=<alphanumeric/-> with the new version, in both HTML files.
sed -i -E "s/\\?v=[A-Za-z0-9_-]+/?v=${VERSION}/g" app.html index.html

echo "Updated:"
grep -nE "\\?v=" app.html index.html | head -20 || true
