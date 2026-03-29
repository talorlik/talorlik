#!/usr/bin/env bash
# Run in CI (or locally): refresh SVG assets, render Tech Stack for README + docs/index.html,
# then patch README live badges + recent activity when GITHUB_TOKEN is set.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export GH_USERNAME="${GH_USERNAME:-talorlik}"

npm ci
npm run render-skills

bash scripts/fetch-readme-svgs.sh

if [[ -n "${GITHUB_TOKEN:-}" ]] || [[ -n "${GH_TOKEN:-}" ]]; then
  export GITHUB_TOKEN="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
  node scripts/patch-readme-dynamic.mjs
else
  echo "ci-update-readme: skipping API patch (set GITHUB_TOKEN or GH_TOKEN for live badges and activity)"
fi
