# Hosting, and how to make the repo private

## Where things run today (September 2026)

| Piece | Where | Deploys when |
| --- | --- | --- |
| The site (`index.html`, `js/`, `css/`, `data/`, `assets/`) | GitHub Pages, from the `main` branch of `no-ahb/incubator-site` | Every push to `main` (including the admin's own commits) |
| Domain `www.incubatorart.com` | DNS at OVH: `www` CNAME → `no-ahb.github.io`, apex A records → GitHub | — |
| Admin Worker (`worker/`) | Cloudflare Workers, `incubator-report-issue` | Only when someone runs `npx wrangler deploy` |

The repo is **public**. That is currently *required*: GitHub Pages only serves
from a private repo on a paid GitHub plan, so making it private on the free
plan would take the site down.

## Recommendation: Cloudflare Pages, free

Move the site's hosting from GitHub Pages to **Cloudflare Pages**, keep the
code on GitHub as a **private** repo. Cloudflare Pages deploys from private
repos for free, sits on Cloudflare's CDN, gives HTTPS, and lets the repo's
`_headers` and `_redirects` files add security headers and the apex → www
redirect (GitHub Pages ignores both). The admin Worker is already on Cloudflare,
so everything server-side ends up in one free account.

Nothing about the site's code changes: it's the same static files, and the
admin Worker keeps committing to GitHub, which triggers a Pages build exactly
as it triggers GitHub Pages today.

Alternatives considered:

- **GitHub Pro (US$4/month) and keep GitHub Pages.** Works, minimal change, but
  costs money and still can't set response headers or rate-limit anything.
- **Netlify / Vercel free tiers.** Equivalent to Cloudflare Pages, but the
  Worker is already on Cloudflare and Cloudflare's free tier has no bandwidth
  cap.

## The cutover, step by step

Do these in order. The site stays up throughout; the only user-visible change
is at step 6, and it is reversible by putting the old DNS records back.

### 1. Cloudflare account and Pages project (10 min)

1. Sign in at dash.cloudflare.com with the account that owns the Worker
   (`noahberrie7`).
2. **Workers & Pages → Create → Pages → Connect to Git.** Authorise the
   Cloudflare GitHub App for the `no-ahb` account and choose
   `incubator-site`. (Do this **before** making the repo private; the app then
   keeps access.)
3. Build settings: framework **None**, build command **empty**, build output
   directory **`/`** (the repo root). Production branch **`main`**.
4. Save and deploy. You get `https://incubator-site-xxx.pages.dev`. Open it and
   click around; it should look identical to the live site. The admin page will
   say "Origin not allowed" until step 2 below.

### 2. Allow the new origin in the Worker (2 min)

In `worker/wrangler.toml`, add the `pages.dev` URL to `ALLOWED_ORIGINS`
(keep `https://www.incubatorart.com` and `https://incubatorart.com`), then:

```bash
cd worker && npx wrangler deploy
```

Test the admin page on the `pages.dev` URL: sign in, open the Press tab, no
changes needed. Every save commits to `main`, which now triggers **both**
GitHub Pages and Cloudflare Pages — fine during the overlap.

### 3. Add the domain to Cloudflare (15 min, plus DNS propagation)

Cloudflare Pages can serve `www` from a CNAME at OVH, but the bare
`incubatorart.com` needs Cloudflare DNS for the redirect. Simplest is to move
the whole zone's nameservers to Cloudflare (free plan); email keeps working as
long as the records are copied over.

1. **Cloudflare → Add a site → `incubatorart.com` → Free plan.** Cloudflare
   scans the existing OVH records; check that it picked up **every** record,
   especially the Google Workspace mail records: `MX`, `TXT` (SPF, DKIM at
   `google._domainkey`, `google-site-verification`). Add any it missed by hand
   (compare against the OVH zone page). While you're there, the SPF record is
   wrong for Google mail: it should contain `include:_spf.google.com`, not
   `include:mx.ovh.com`.
2. Cloudflare shows two nameservers. At **OVH → Domains → incubatorart.com →
   DNS servers**, replace OVH's with those two. Propagation takes minutes to a
   day; the site keeps serving from GitHub Pages meanwhile because the copied
   records still point there.
3. When Cloudflare says the site is **Active**, go to the Pages project →
   **Custom domains → Set up a custom domain → `www.incubatorart.com`**.
   Cloudflare rewrites the `www` CNAME to the Pages project itself. Then add
   `incubatorart.com` as a second custom domain the same way; the repo's
   `_redirects` file sends it to `www`.

### 4. Check the live site (5 min)

- `https://www.incubatorart.com` loads and the browser padlock is valid.
- `https://incubatorart.com/#/press` redirects to `https://www.incubatorart.com/#/press`.
- `https://www.incubatorart.com/#/admin`: sign in, open a tab, no red banner.
- In the browser's developer tools, the Network tab's response headers for the
  page include `content-security-policy` (that's the `_headers` file working).
- Send yourself an email at the gallery address to prove mail still arrives.

### 5. Make the repo private (2 min)

GitHub → repo → **Settings → General → Danger Zone → Change visibility →
Private**. Then:

- **Settings → Pages → Source: None** (unpublish GitHub Pages).
- Delete the `CNAME` and `.nojekyll` files from the repo when convenient; they
  are GitHub-Pages-only and harmless.

The Cloudflare GitHub App keeps deploying. The Worker's fine-grained token is
scoped to the repo and keeps working. Screenshots attached to issues are
linked through `github.com/…/blob/…?raw=true`, which renders for anyone with
access to the private repo.

### 6. Tidy up (optional)

- Turn on **Cloudflare → Security → Bots → Bot Fight Mode** (free).
- **Speed → Optimization → Brotli** is on by default; the 3 MB Babel script
  compresses to about 600 KB.
- The Pages free plan allows 500 builds a month. Every admin save and every
  uploaded image is one commit, so one build each; a show with ten photos is
  eleven builds. Plenty for a gallery, but worth knowing.

## What "hardening" was done in the code

- **Admin saves explain themselves.** An expired GitHub token used to surface
  as "Internal error."; now the Worker says what failed and the admin page
  warns three weeks before the token expires (`/admin/health`).
- **Password brute-force protection.** Ten wrong passwords a minute per IP,
  then 429. The old Worker accepted unlimited guesses.
- **The anonymous issue-report route is gone.** Anyone who found the Worker URL
  could commit screenshots to the repo and open issues.
- **Links are sanitised server-side.** Press, Contact and show links must be
  `http(s)`; a `javascript:` URL can't reach the public site even with the
  password.
- **Security headers** (`_headers`): a Content-Security-Policy that only lets
  the page talk to itself, the Worker and Google Maps; no framing; no MIME
  sniffing. Applied once the site is on Cloudflare Pages.
- **No third-party CDN at page load.** React and Babel are served from the
  repo (`js/vendor/`, version-pinned), so an unpkg outage can't blank the site.

## Things to keep an eye on

- **GitHub token expiry.** Max lifetime is one year; the admin page nags from
  three weeks out. Rotation is one command (`worker/README.md`).
- **Wrangler login expires** too. `npx wrangler login` again when a deploy or
  `wrangler tail` says "Not logged in".
- **`data/shows.json` size.** It is ~260 KB today. The Worker reads and
  rewrites it on every save through GitHub's Contents API, which caps files at
  1 MB. Long before that, move press releases out of the file or split it.
