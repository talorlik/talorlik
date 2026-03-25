#!/usr/bin/env bash
# Download third-party SVG cards and activity graph into docs/generated/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/docs/generated"
mkdir -p "$OUT"
USER="${GH_USERNAME:-talorlik}"
BASE_STATS="https://github-readme-stats.vercel.app"
curl -fsSL "${BASE_STATS}/api?username=${USER}&show_icons=true&theme=tokyonight&include_all_commits=true&count_private=true&hide_border=true" \
  -o "$OUT/stats.svg"
curl -fsSL "${BASE_STATS}/api/top-langs/?username=${USER}&layout=compact&theme=tokyonight&hide_border=true&langs_count=8" \
  -o "$OUT/top-langs.svg"
curl -fsSL "https://streak-stats.demolab.com?user=${USER}&theme=tokyonight&hide_border=true&date_format=M%20j%5B%2C%20Y%5D" \
  -o "$OUT/streak.svg"
curl -fsSL "https://github-readme-activity-graph.vercel.app/graph?username=${USER}&theme=tokyo-night&hide_border=true&area=true" \
  -o "$OUT/github-activity.svg"
