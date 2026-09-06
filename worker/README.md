# Admin Worker

A one-file Cloudflare Worker that powers the staff admin page at
`https://www.incubatorart.com/#/admin`: add / edit / hide shows, edit the
About, Contact and Press pages, and file or list issue reports. It holds the
GitHub token server-side and commits every change to `data/shows.json` (and
images under `assets/`) in the repo, so the site redeploys on push. The
browser never sees the token; the Worker checks the admin password on every
request.

The site finds the Worker through `window.REPORT_ISSUE_ENDPOINT` in
`index.html`.

## Endpoints

Every request must come from an allow-listed origin and carry an
`X-Admin-Password` header. A wrong password returns 401; after 10 wrong
passwords in a minute from one IP the Worker answers 429 for the rest of that
minute (the `ADMIN_LIMITER` binding in `wrangler.toml`).

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/admin/login` | POST | Validate the password (gates the UI). |
| `/admin/health` | GET | Can the Worker reach GitHub? Returns the token's expiry date. The admin page shows a banner from this. |
| `/admin/save-show` | POST | Create or edit a show (+ upsert its artist). |
| `/admin/visibility` | POST | Hide / unhide a show. |
| `/admin/upload` | POST | Upload one image to `assets/shows/<id>/`. |
| `/admin/save-content` | POST | Save the About / Contact / Press page content. |
| `/admin/issues` | GET | List open reported issues. |
| `/admin/create-issue` | POST | File a new issue from the admin page. |

There is no anonymous route any more. The public "Report an issue" button was
removed from the site, and an unauthenticated endpoint that commits files and
opens issues was a spam vector.

## Config (`wrangler.toml`)

| Key | Meaning |
| --- | --- |
| `REPO` | `owner/repo` that content and issues live in. |
| `ALLOWED_ORIGINS` | Comma-separated origins allowed to call the Worker. Must include the live site origin. |
| `ISSUE_LABEL` | Label applied to every created issue (empty to disable). |
| `ADMIN_LIMITER` | Rate-limit binding for wrong-password attempts. |
| `GITHUB_TOKEN` | **Secret** — set with `wrangler secret put`, never in this file. |
| `ADMIN_PASSWORD` | **Secret** — the shared staff password. |

## One-time setup

1. **Create a fine-grained GitHub token** scoped to the one repo:
   GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token.
   - Repository access: **only** `no-ahb/incubator-site`.
   - Permissions: **Contents: Read and write**, **Issues: Read and write**.
   - Expiration: choose **1 year** (the maximum). Fine-grained tokens always
     expire; put the date in your calendar. See "Rotate the GitHub token".

2. **Deploy:**

   ```bash
   cd worker
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN     # paste the token
   npx wrangler secret put ADMIN_PASSWORD   # choose a strong shared password
   npx wrangler deploy
   ```

3. Make sure `window.REPORT_ISSUE_ENDPOINT` in `index.html` is the URL that
   `wrangler deploy` printed.

## Rotate the GitHub token

The admin page warns three weeks before the token expires ("The Worker's
GitHub token expires on …"). Once it has expired every save fails with
"GitHub rejected the Worker's token (401)". To fix:

```bash
# 1. Create a new fine-grained token exactly as in setup step 1.
# 2. Store it and redeploy nothing — secrets take effect immediately:
cd worker
npx wrangler login            # only if it says you're logged out
npx wrangler secret put GITHUB_TOKEN
```

Then reload the admin page; the banner disappears when the new token is seen.
Delete the old token on GitHub afterwards.

## Deploying a code change

A push to `main` deploys the **site**, not the Worker. After editing
`worker.js` or `wrangler.toml`:

```bash
cd worker
npx wrangler deploy
```

The admin page tells you when the deployed Worker is older than the site
expects ("The Worker is out of date").

## Testing locally without touching GitHub

The scratch harness used to verify changes runs the Worker under Node against
a mock GitHub API, so nothing is committed to the real repo:

- `GITHUB_API_BASE` (a var) redirects every GitHub call. Only set it for tests.
- `wrangler dev` also works: create `worker/.dev.vars` (git-ignored) with
  `GITHUB_TOKEN`, `ADMIN_PASSWORD` and optionally `GITHUB_API_BASE`, then
  `npx wrangler dev`. `http://localhost:8000` is already in `ALLOWED_ORIGINS`.

## End-of-show reminder email

Still dormant — see the commented blocks at the bottom of `wrangler.toml` and
issue #88 for the Email Routing steps.
