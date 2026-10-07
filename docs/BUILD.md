# Building and publishing the website

Use Node 22.12 or later, then run:

```sh
npm ci
npm run build
npm test
npm run preview
```

Preview is served at http://127.0.0.1:8003. The build writes the deployable site
to `_site/`: complete HTML for every visible exhibition and artist, a compiled
React bundle, responsive WebP images, a sitemap, and robots.txt. The source
`index.html` is a build template, not a deployable page.

Public URLs use `/exhibitions/slug/` and `/artists/slug/`. Old `/#/...` links
continue to open their matching pages and are replaced with clean URLs in the
browser. Unknown paths return a real 404. Admin and 404 pages are noindex.

GitHub Pages uses `.github/workflows/pages.yml`, with Source set to **GitHub
Actions**. Pushes to main (including saves from the admin Worker) build, test
and publish the whole artifact. Failed builds leave the previous deployment
in place. A twice-daily build refreshes date-based labels around London midnight;
the browser also refreshes them automatically. DNS and the Worker are unchanged.

Image variants are cached under `.cache/images` locally and in Actions. They
are named by source content, dimensions, encoding and Sharp version. Original
images are retained for the full-screen viewer. New uploads are included at
the next successful build. Only an explicit public-file list is published.

To roll back, use a previous successful Pages deployment, or revert the change
on main and let the workflow republish. Do not change Pages to branch/root
publishing while `index.html` is a template.

## Local UX prototype

`node scripts/prototype.cjs` creates `.cache/ux-preview/` after a site build.
Preview it with `PORT=8004 node scripts/preview.cjs .cache/ux-preview`.
It adds homepage visitor information and a direct footer signup link for review.
Neither change is included in production.

## Search-engine management

The sitemap is https://www.incubatorart.com/sitemap.xml. Submit this URL in
the gallery's Google Search Console and Bing Webmaster Tools accounts. A
URL-prefix property can use HTML verification without changing DNS. Account
verification files or tags must be explicitly added to the build's public-file
list/template when supplied; never publish account credentials.
