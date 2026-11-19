# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b` type check, `vite build`, then `scripts/prerender.mjs` (writes into `dist/index.html`)
- `npm run preview` — serve `dist/`
- `npm run build:data` — regenerate `public/data/cities.json` and `countries.json` from CSVs (manual, not part of build)
- `npm run prerender` — re-run prerender step alone against existing `dist/`
- `npm run sbom` — regenerate `sbom.cdx.json` (CycloneDX, from `package-lock.json`); rerun and commit after any dependency change
- `npm run sbom:check` — fails if `sbom.cdx.json` is stale; runs in CI (`.github/workflows/sbom.yml`, the only workflow)

No test runner or linter configured. Type checking (`npx tsc -b`) is the only static check; `tsconfig.json` is strict with `noUnusedLocals`/`noUnusedParameters`, so unused code fails the build.

## Architecture

Vanilla TypeScript + Leaflet SPA, no framework, no backend. Deployed as static site (Vercel, `geo-explorer-mu.vercel.app`).

### Data pipeline (build-time, not runtime)

`scripts/build-data.mjs` turns raw CSVs into static JSON in `public/data/`:
- `countries.csv` (tracked) — `Name,Code`
- `cities.csv` (gitignored, ~160MB / 3.1M rows, streamed) — only rows with population > 0 kept
- Country lat/lng is **not** real data: it's the mean of that country's populated-city coordinates. Countries with no populated cities are dropped.

Generated `cities.json` / `countries.json` are committed, so `cities.csv` is only needed when regenerating. Shapes must match `src/types.ts` (`City`, `Country`).

`public/data/countries-boundaries.geojson` and `public/flags/<iso2-lowercase>.svg` are static assets, independent of the pipeline.

### Frontend (`src/`)

- `main.ts` — map setup, boundary overlay (GeoJSON with permanent tooltips, shown via `.show-country-names` CSS toggle on `#map`), search wiring, popups. Fetches all data from `/data/*` at startup; whole city list held in memory.
- `search.ts` — pure function: case-insensitive substring match; countries first, then cities by population desc, capped at 10 total.
- Leaflet default marker icons are re-pointed at Vite-imported asset URLs (otherwise broken after bundling) — keep that block when touching marker code.
- Map and tile layer `maxZoom` share `TERRAIN_MAX_ZOOM` (9): Esri World Terrain Base serves "Map data not yet available" placeholder tiles from zoom 10 up. City `flyTo` uses `map.getMaxZoom()`.

### SEO / prerender

App is client-rendered, so `scripts/prerender.mjs` injects crawlable static HTML (country list + top 20 cities) into `dist/index.html` between the `<!-- prerender:start ... -->` / `<!-- prerender:end -->` markers. Those markers in `index.html` must stay intact or the build throws. The injected section is `.visually-hidden`.

`index.html` also holds meta/OG/Twitter/JSON-LD tags. `public/robots.txt` deliberately allows AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.); `public/sitemap.xml` and `public/llms.txt` target the production domain — update them together if the domain changes.
