# Build — SEO prerender

The site is a client-rendered React SPA. Search engines and (especially) AI
crawlers like GPTBot / ClaudeBot / PerplexityBot mostly **don't run JavaScript**,
so without help they'd see an empty page. This build fixes that by emitting a
real, fully-rendered HTML file for every route.

## What it produces

`node build/prerender.mjs` reads `data/shows.json` and writes, into the repo root:

- **One flat `.html` per route** — `index.html` (home), `exhibitions.html`,
  `exhibitions/<id>.html` (one per show), `artists/<id>.html`, `about.html`,
  `contact.html`, `press.html`, `admin.html`. Flat files mean GitHub Pages
  serves clean URLs (`/exhibitions/foo` → `exhibitions/foo.html`) with **no
  trailing-slash redirect**, matching the canonical URLs.
- Each page contains the **real content** (headings, press releases, bios,
  installation images with alt text) plus per-page `<title>`, meta description,
  canonical, Open Graph / Twitter tags, and **JSON-LD** (`ArtGallery` +
  `WebSite` on home/about/contact, `ExhibitionEvent` per show, `Person` per
  artist, `BreadcrumbList` on detail pages).
- **`sitemap.xml`** listing every public URL.

The React app still boots on top for humans: `js/app.jsx` waits for the data
load before its first mount, then swaps the prerendered `#root` for the live app
in a single step — no loading flash. Routing is real paths via the History API
(`js/app.jsx`); legacy `#/…` links are rewritten to clean paths on load.

## Editing

- **Content** (shows, artists) lives in `data/shows.json` — edit via `/admin`.
- **Page templates, metadata, JSON-LD** live in `build/prerender.mjs`.
- **About / Contact copy** is duplicated in `build/prerender.mjs` (server) and
  `js/screens.jsx` (client) — keep them in sync if you change that copy.
- After changing templates, run `node build/prerender.mjs` and commit the result.

## Preview locally

```bash
node build/prerender.mjs     # generate pages
node build/serve.mjs         # serve at http://localhost:8000 with GH-Pages-style routing
```

## Automation

`.github/workflows/prerender.yml` reruns the build and commits the regenerated
pages whenever `data/shows.json` changes on `main` (e.g. after an `/admin` edit),
so the static HTML is always current. GitHub Pages then redeploys.

## Favicons

`build/make-favicons.py` regenerates `favicon.svg/.ico`, `apple-touch-icon.png`
and `icon-192/512.png` from the site's own typeface — a green (`#009838`) "I" in
Century Schoolbook. Re-run only if the brand mark changes (needs `fonttools` +
ImageMagick).
