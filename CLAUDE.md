# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A GitHub profile README + personal portfolio site for Tal Orlik (DevOps Engineer & Cloud Architect). The repo auto-generates:
- `README.md` — the GitHub profile page at github.com/talorlik
- `docs/index.html` — the portfolio site at talorlik.github.io/talorlik/

## Commands

```bash
# Render tech stack SVG and inject web components into docs/index.html
npm run render-skills

# Full update pipeline (install → render → fetch SVGs → patch live metrics)
bash scripts/ci-update-readme.sh

# Individual steps
node scripts/render-skills-readme.mjs   # Render tech stack from SKILLS_MANIFEST.yaml
node scripts/patch-readme-dynamic.mjs   # Inject live GitHub metrics (requires GITHUB_TOKEN or GH_TOKEN)
bash scripts/fetch-readme-svgs.sh       # Download third-party SVG assets
```

There are no tests in this project.

## Architecture

### Two-Phase Generation

**Phase 1 — Static** (`render-skills-readme.mjs`):
- Parses `docs/SKILLS_MANIFEST.yaml` (single source of truth for 43+ skills across 7 sections)
- Downloads and caches skill icons from three sources: `skillicons.dev`, `cdn.simpleicons.org`, or local SVGs in `docs/profile-icons/`
- Renders a tech stack SVG (`docs/generated/tech-stack.svg`) with 48px icons and tooltip metadata
- Injects into `README.md` between `<!--START_SECTION:skills_icons-->` / `<!--END_SECTION:skills_icons-->` markers
- Injects semantic HTML into `docs/index.html` between `<!--START_TECH_STACK_WEB-->` / `<!--END_TECH_STACK_WEB-->` markers

**Phase 2 — Dynamic** (`patch-readme-dynamic.mjs`):
- Calls GitHub API for live follower/star/repo counts and recent public events
- Injects Shields.io badges into `README.md` between `<!--START_SECTION:github_stats-->` / `<!--END_SECTION:github_stats-->` markers
- Injects recent activity feed between `<!--START_SECTION:activity-->` / `<!--END_SECTION:activity-->` markers

### Content Sources

| File | Purpose |
|------|---------|
| `docs/SKILLS_MANIFEST.yaml` | Canonical skill definitions (id, section, label, last_used, rating 1-4, icon config) |
| `docs/REPO_INDEX.md` | Featured projects listing |
| `docs/profile-icons/` | Custom local SVG icons for skills not on CDNs |
| `docs/generated/` | Auto-generated SVGs committed to the repo (never edit manually) |

### Marker-Based Injection

All dynamic content is injected by replacing everything between HTML comment markers. This pattern is used throughout `README.md` and `docs/index.html`. Never remove or reorder these markers.

### CI/CD

GitHub Actions workflow (`.github/workflows/update-readme.yaml`) runs every 30 minutes:
1. Generates GitHub stats/top-langs cards via `readme-tools` action
2. Runs `scripts/ci-update-readme.sh`
3. Commits and pushes any changes

### Skills Manifest Schema

```yaml
version: 1
icon_size: 48
sections:
  - id: cloud
    label: Cloud
    skills:
      - id: aws
        label: AWS
        last_used: "2025-01"
        rating: 4           # 1=Beginner, 2=Intermediate, 3=Advanced, 4=Expert
        rating_label: Expert
        icon_kind: skillicons  # or: simpleicons, local
        icon_slug: aws
        link: https://aws.amazon.com/
```

### Portfolio Site

- `docs/index.html` + `docs/styles.css` — Tokyo Night dark theme (`#0b0e14` bg, `#00d9ff` accent)
- `docs/main.js` — Injects Schema.org JSON-LD (Person/WebPage/WebSite) for SEO
- All icons/assets must be self-hosted or inlined (GitHub Pages has no server-side processing)

## Key Constraints

- **ESM only** — `"type": "module"` in `package.json`; all scripts use `.mjs` extension and `import`/`export`
- **Minimal dependencies** — only the `yaml` npm package; everything else uses Node built-ins or fetch
- **Icon CDN rate limits** — `skillicons.dev` has per-query limits; script fetches icons one at a time with retries
- **Dual output** — every skills change must propagate to both `README.md` and `docs/index.html`; run `npm run render-skills` after editing `SKILLS_MANIFEST.yaml`
