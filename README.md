# geo_explorer

Interactive world map for searching cities and countries, viewing country boundaries, and looking up basic geographic data (population, coordinates).

Live: https://geo-explorer-mu.vercel.app

Built with TypeScript, [Vite](https://vitejs.dev/) and [Leaflet](https://leafletjs.com/). Fully static — no backend; all data ships as JSON/GeoJSON under `public/data/`.

## Getting started

Requires Node.js 18+.

```sh
npm install
npm run dev       # start dev server
npm run build     # type check, bundle to dist/, prerender static content
npm run preview   # serve dist/ locally
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b`, `vite build`, then `scripts/prerender.mjs` |
| `npm run preview` | Serve the production build |
| `npm run build:data` | Regenerate `public/data/cities.json` and `countries.json` from CSV |
| `npm run prerender` | Re-inject crawlable HTML into `dist/index.html` |
| `npm run sbom` | Regenerate `sbom.cdx.json` from `package-lock.json` |

## Data

| File | Source |
| --- | --- |
| `public/data/cities.json` | Generated from `cities.csv` (only cities with population > 0) |
| `public/data/countries.json` | Generated from `countries.csv`; coordinates are the mean of each country's city coordinates, not official centroids |
| `public/data/countries-boundaries.geojson` | Country border polygons (static) |
| `public/flags/*.svg` | Country flags, named by lowercase ISO 3166-1 alpha-2 code |

The generated JSON files are committed. To regenerate them, place `cities.csv` (~160MB, gitignored; columns `Country,City,AccentCity,Region,Population,Latitude,Longitude`) in the repo root and run `npm run build:data`.

Map tiles: Esri World Terrain Base.

## SEO / GEO

The app is client-rendered, so `npm run build` runs `scripts/prerender.mjs` to inject static, crawlable HTML (country list and largest cities) into `dist/index.html` between the `prerender:start` / `prerender:end` markers. Keep those markers in `index.html`, or the build fails.

`index.html` includes meta, Open Graph, Twitter and JSON-LD tags. `public/llms.txt` describes the site for LLM agents.

`public/robots.txt` allows AI crawlers and answer-engine bots (OpenAI's `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`; Anthropic's `ClaudeBot`, `Claude-User`, `Claude-SearchBot`, `anthropic-ai`; Perplexity, Google-Extended, Applebot-Extended, Meta, Bytespider, Amazonbot), so the site can be indexed and surfaced in SearchGPT and other live AI conversations.

`public/sitemap.xml` is referenced from `robots.txt` and points to `https://geo-explorer-mu.vercel.app/sitemap.xml`.

## SBOM

`sbom.cdx.json` is a [CycloneDX](https://cyclonedx.org/) 1.5 software bill of materials generated from `package-lock.json` with `npm sbom`. Regenerate it with `npm run sbom` after changing dependencies.

## License

[MIT](LICENSE)

## Contributors

- Sérgio Ildefonso (s.ildefonso@runtime-revolution.com)
