# Report-an-issue Worker

A one-file Cloudflare Worker that turns a report from the live site into a
GitHub issue. It holds the GitHub token server-side, so reporters need no GitHub
account and the token never reaches the browser. Optional screenshots are
uploaded to the repo and embedded in the issue.

The site (`incubator-site`) calls this Worker when `window.REPORT_ISSUE_ENDPOINT`
is set. Until then the site falls back to GitHub's prefilled "New issue" page.

## One-time setup

Issues are created in **`no-ahb/incubator-site`** — the same repo as the live
site, so reports land where the code is fixed. (It's already public, so embedded
screenshots render. To use a different repo, change `REPO` in `wrangler.toml`.)

1. **Create a fine-grained token** scoped to that one repo:
   GitHub → Settings → Developer settings → Fine-grained tokens →
   Repository access: only the target repo → Permissions:
   **Issues: Read and write** and **Contents: Read and write** (Contents is only
   needed for screenshot upload).

2. **Deploy:**

   ```bash
   cd worker
   npx wrangler login
   npx wrangler secret put GITHUB_TOKEN   # paste the token when prompted
   npx wrangler deploy
   ```

   Deploy prints a URL like `https://incubator-report-issue.<you>.workers.dev`.

3. **Point the site at it.** In `incubator-site/index.html`:

   ```js
   window.REPORT_ISSUE_ENDPOINT = "https://incubator-report-issue.<you>.workers.dev";
   ```

   Commit + push `incubator-site`. Issues now get created automatically.

## Config (`wrangler.toml`)

| Key               | Meaning                                                        |
| ----------------- | -------------------------------------------------------------- |
| `REPO`            | `owner/repo` issues are created in.                            |
| `ALLOWED_ORIGINS` | Comma-separated origins allowed to call the Worker.            |
| `ISSUE_LABEL`     | Label applied to every created issue (set empty to disable).   |
| `GITHUB_TOKEN`    | **Secret**, not in this file — set via `wrangler secret put`.  |

When the live Pages origin is known, make sure it's in `ALLOWED_ORIGINS`
(default already includes `https://no-ahb.github.io`).

## Test it

```bash
curl -X POST https://incubator-report-issue.<you>.workers.dev \
  -H 'Origin: https://no-ahb.github.io' \
  -H 'Content-Type: application/json' \
  -d '{"title":"Test report","body":"Hello from curl"}'
# -> {"ok":true,"url":"https://github.com/.../issues/1","number":1}
```

## Admin CMS (the `/admin` page)

The same Worker also powers the staff admin page at `/#/admin` on the site —
add / edit / hide shows and view reported issues. Writes are committed to
`data/shows.json` (and images under `assets/shows/<id>/`) in the repo, so the
site redeploys on push. The browser never sees the GitHub token; the Worker
checks the admin password on every write.

**One extra secret is required:**

```bash
cd worker
npx wrangler secret put ADMIN_PASSWORD   # choose a strong shared password
npx wrangler deploy
```

The existing `GITHUB_TOKEN` already needs **Contents: Read and write** (it's
used for screenshot uploads), which is the same permission the admin endpoints
use — no token change needed.

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/admin/login` | POST | Validate the password (gates the UI). |
| `/admin/save-show` | POST | Create or edit a show (+ its artist). |
| `/admin/visibility` | POST | Hide / unhide a show. |
| `/admin/upload` | POST | Upload one image to `assets/shows/<id>/`. |
| `/admin/issues` | GET | List open reported issues. |

Every admin request carries an `X-Admin-Password` header and must come from an
allow-listed origin. A wrong/missing password returns 401; the Worker is the
real lock — the page's password prompt is only for convenience.
