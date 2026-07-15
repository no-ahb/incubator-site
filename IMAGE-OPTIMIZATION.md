# Image optimization plan (post-launch)

Images are ~95% of this site's weight (`assets/shows/` ≈ 148 MB after the
July 2026 recompression pass). Every visitor currently downloads the same
single JPEG per image regardless of screen size. This plan cuts typical page
weight by 60–80% while *improving* quality on large retina screens.

Do this on its own branch with side-by-side visual review — it touches every
image on an image-first site.

## Target architecture

One master per image → pre-generated variants, committed to the repo,
served by GitHub Pages (no new infrastructure, no monthly cost).

- **Sizes:** 480 / 800 / 1200 / 1600 / 2400 px wide (skip sizes larger than
  the master).
- **Formats:** AVIF (primary, ~40–60% smaller than JPEG at equal quality),
  WebP (fallback), JPEG (last resort). Settings: sRGB, metadata stripped,
  light sharpen after downscale; AVIF q60–65, WebP q80–82, mozjpeg q80.
- **Markup:** `Poster` and `Tile` (js/components.jsx) emit
  `<picture>` + `srcset`/`sizes` instead of a bare `<img>`; keep
  `loading="lazy" decoding="async"` and add `width`/`height` to kill layout
  shift. Preload the homepage hero (it's the LCP element).
- **Masters:** where originals exist at >1600px (gitignored `source/`,
  `WEBSITE IMAGES*/`), regenerate the 2400px variant from those — the current
  1600px files are *under* ideal for full-bleed heroes on 13"+ retina.

## Work items

1. `scripts/build-images.mjs` (or a Makefile target using ImageMagick +
   `avifenc`/`cwebp`): walks `assets/shows/`, writes variants next to each
   file (`hero.jpg` → `hero-800.avif`, `hero-800.webp`, `hero-800.jpg`, …).
   Idempotent — skips variants newer than their master.
2. A `pictureSources(src)` helper in js/components.jsx that maps a stored
   path to its variant set; `Poster`/`Tile`/lightbox adopt it. Data in
   shows.json keeps storing the single master path — no schema change.
3. Worker upload path (`worker/worker.js` `uploadImageToRepo`): generate the
   same variants on upload (Workers can't run ImageMagick — either do the
   resize client-side in the admin before upload, mirroring the existing
   canvas resize in js/admin.jsx, or commit masters only and let a GitHub
   Action run the build script on push).
4. Visual QA: pick 4–5 shows (dense texture, flat colour, low light),
   render old vs new at 1×/2× on WebKit, and have Angelica/staff approve
   before merge.

## Alternative: image CDN

A CDN (Cloudflare Images ~$5/mo — natural fit since the admin Worker already
runs on Cloudflare; or imgix/Cloudinary) stores one master and generates any
size/format on the fly from URL params, with edge caching. Zero build step
and future uploads need no processing — at the cost of a paid dependency and
account. Revisit if the pre-generated-variant workflow becomes annoying for
staff; the `<picture>` component work carries over unchanged.

## Expected outcome

- Repo assets: 148 MB → roughly 35–50 MB transferred worst-case, with
  phones pulling the 480/800px AVIFs (tens of KB each).
- Homepage image payload: ~2 MB → ~300–500 KB on desktop, less on mobile.
- Sharper heroes on large screens (2400px masters where sources exist).
