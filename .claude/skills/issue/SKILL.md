---
name: issue
description: Work one GitHub issue on the Incubator site end-to-end on its own branch — read the issue, reproduce, fix, verify in a real browser, run the mandatory /simplify → /code-review → /security-review review gauntlet (each skill invoked top-level so its own review agents run; a subagent re-checks every affected route in a browser after each step), commit, then present plain-language trade-offs. On approval: push + PR + merge to main (deploys GitHub Pages) + close the issue. Built for the report-issue widget's "site-report" issues but works for any issue.
trigger: /issue
allowed-tools: Skill
---

# /issue

Take one GitHub issue and carry it through a full, isolated pipeline:
**pick up the issue → branch → reproduce → diagnose → fix → verify in a browser → /simplify → /code-review → /security-review → commit → present trade-offs → (on approval) push + PR + merge + close.**

You say `/issue` and point at an issue ("work on issue 42", a URL, or "the latest open one"). One issue per run.

This repo is a **static site on GitHub Pages**: plain `index.html` + `css/*.css` + `js/*.jsx` (React via in-browser Babel-standalone — no bundler, no `node_modules`, no test runner). It **deploys to production by merging to `main`**. Issues are filed by the in-app report-issue widget (`js/report-issue.jsx` → Cloudflare worker) and carry the label **`site-report`**; each includes the page URL, user agent, free text, and often a screenshot.

- `REPO = no-ahb/incubator-site`
- Routing is hash-based: `#/`, `#/exhibitions`, `#/exhibitions/<id>`, `#/artists/<id>`, `#/press`, `#/about`, `#/contact`.

---

## HARD RULES — read before doing anything

1. **Nothing leaves the machine until the user approves — then everything does.** No `git push`, PR, merge, or issue close during the fix. On approval, run the whole Phase 8 closeout in one go without re-asking between steps. Merging to `main` is a **production deploy**, so that approval is the explicit yes the push/merge needs.
2. **Always verify the change in a real browser before claiming it works** (Phase 5). There is no test runner — a green screenshot of the affected route is the gate. JSX errors only surface at runtime (Babel-standalone), so "it compiles" is not a thing here; load the page.
3. **The Phase 6 review gauntlet is mandatory and never silently skipped** — /simplify → /code-review → /security-review run in that fixed order on every issue, each invoked top-level (not wrapped in a subagent).
4. **Keep the diff minimal** — fix the one issue, no drive-by refactors or new abstractions. Default to no comments; add one only where the *why* is non-obvious.
5. **Tone:** direct, plain, brief. State the result and stop. No filler, no recap.
6. **Source materials stay local.** `source/` and `about-image.heic` are gitignored on purpose (large originals). Publish only optimized assets under `assets/`.

`ROOT=/Users/noahberrie/Developer/incubator-site`

---

## Pipeline

### Phase 1 — Pick up the issue & branch
1. Resolve which issue. If a number/URL was given, use it. If not, `gh issue list --state open --label site-report` and ask which (or take the one the user named).
2. Read it: `gh issue view <n> --comments`. Pull out: **title**, **what's wrong** (free text), **page URL** (→ which route/screen), **screenshot** (embedded image URL), **labels**. Restate the problem in one plain-English line.
3. Branch off the latest main (a "work branch"):
   ```bash
   cd "$ROOT"
   git fetch origin main
   git switch -c fix/issue-<n>-<slug> origin/main
   ```
   `<slug>` = short lowercase topic, e.g. `about-image-overflow`. (For several issues in parallel, use a worktree under `.claude/worktrees/` instead so branches don't collide — otherwise a branch is fine.)

### Phase 2 — Reproduce & locate
- Map the issue's page URL to the screen/component. Screens live in `js/screens.jsx`, shared pieces in `js/components.jsx`, data in `js/data.jsx`, styles in `css/site.css` (+ `ds.css`, `mockups.css`, `app.css`).
- If there's a screenshot, `curl -sL "<url>" -o /tmp/issue-<n>.png` and Read it to see exactly what they saw.

### Phase 3 — Diagnose
State the root cause in one or two plain sentences. Note confidence and anything uncertain.

### Phase 4 — Fix (on the branch)
Edit the relevant `js/*.jsx` / `css/*.css` / `index.html`. Match surrounding style (the codebase uses `function` components, BEM-ish `inc-*` classes, CSS custom props like `var(--s-12)`). New images: convert/resize to web format (`magick … -auto-orient -resize 1600x1600\> -quality 82 -strip assets/<name>.jpg`) and reference `assets/<name>.jpg`; keep originals out of git.

### Phase 5 — Verify in a browser (the gate)
```bash
(python3 -m http.server 8000 >/tmp/issue-srv.log 2>&1 &)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars --window-size=1280,1400 \
  --virtual-time-budget=6000 --screenshot=/tmp/issue-<n>-after.png \
  "http://localhost:8000/#/<route>"
pkill -f "http.server 8000"
```
Read `/tmp/issue-<n>-after.png` and confirm the fix renders and nothing nearby regressed. Check the affected route plus any route the change could touch. Port 8000 matches the worker's allowed origins, so the report widget works locally too. Report what you saw.

### Phase 6 — Review gauntlet (mandatory · sequential · /simplify → /code-review → /security-review)

**Hardcoded.** All three steps run on every issue, in this exact order, with no skipping or reordering — even for a one-line fix.

**Invoke each skill top-level from this orchestrator loop, one at a time, via the Skill tool — do NOT wrap a skill inside a subagent.** Each is itself a subagent-orchestrated review (`/code-review`, `/security-review`, and `/simplify` fan out to their own internal review agents), and a subagent cannot spawn further subagents — so wrapping one in a subagent would suppress or break its fan-out. Running them at the top level is what lets each skill be *implemented by its own subagents*. The `/issue` frontmatter pre-approves the `Skill` tool, so they run without a permission prompt. Run them in sequence; each sees the working tree as left by the previous step. They review this branch's uncommitted diff (before the Phase 7 commit).

- **Step 6a — `/simplify` (quality).** Invoke `skill: "simplify"`. It reviews the changed code for reuse, simplification, efficiency, and altitude cleanups and **applies** the fixes — quality only; it does **not** hunt for bugs (that's 6b). Stay scoped to files changed this run; preserve behavior; match repo style (`function` components, `inc-*` BEM-ish classes, `var(--s-12)` custom props).
- **Step 6b — `/code-review` (correctness bugs).** Invoke `skill: "code-review"` with args `high --fix` to find correctness bugs in the diff and apply the fixes. Do **not** use the `ultra` level (a billed, user-triggered cloud review you can't launch).
- **Step 6c — `/security-review` (security).** Invoke `skill: "security-review"` on the branch's pending changes. Risk surface for this static site: XSS via `dangerouslySetInnerHTML` or unsanitized issue/URL/user text, secrets or worker origins exposed in client `js/*.jsx`, the report-issue widget → Cloudflare worker path, and anything handling user input or external URLs.

**After each step, a dedicated verification subagent rigorously tests every new branch of code.** This repo has no typechecker, build, or test runner — the gate is the **real-browser render** — so the subagent exercises every code path the fix + this step introduced. Spawn it with **full tool access** (`agentType: general-purpose`, model `sonnet` — `Tools: *`, so it can run the local `http.server` + headless Chrome). It must (1) **enumerate every new or changed code path** — each added conditional/branch, route, conditional render, data/empty/error case — and (2) **re-run the Phase 5 browser check for every affected route** (same `http.server` + headless-Chrome procedure): screenshot each, confirm the fix renders and nothing nearby regressed (JSX errors only surface at runtime here, so loading the page is the only real test). Report the routes checked and the real result. Runs are sequential, so reuse port 8000 and `pkill` between them as Phase 5 does.

**HARD RULE 1 still binds every step:** nothing is pushed, merged, or deployed here — review changes stay local on the branch until the user approves in Phase 8.

Capture per step: what the skill found & changed (or "no changes needed"), every new branch the verification subagent exercised, and the routes screenshotted. **Report all three steps in the Phase 8 "Checked" line** so the whole gauntlet is auditable.

### Phase 7 — Commit
```bash
git add <specific files>
git commit
```
Conventional summary + a body that explains the user-facing problem and the fix, ending with:
```
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```
Stage files by name (never `git add -A` blindly — avoid sweeping in `about-image.heic` or other local originals). **Do not push.**

### Phase 8 — Present (plain language + trade-offs), then wait
Terse. One short line per field; drop any that would say "none". Then stop for the user.
```
**Issue:** #<n> — <one line>
**Cause:** <one line, plain>
**Fix:** <what changed>
**Checked:** <gauntlet — simplify / code-review / security-review, each: found & changed or "no changes" + new branches exercised · browser route(s) re-screenshotted + result>
**Options:** <only if a real fork — ≤2, one line each>
**You:** approve → I push + PR + merge to main (deploys Pages) + close #<n> / tweak / discard
```

### Phase 9 — On approval, close out automatically
"Approve" (or any clear yes) triggers ALL of this in one turn — don't re-ask between steps:
1. `git push -u origin fix/issue-<n>-<slug>`
2. `gh pr create` with a body summarizing the fix and `Closes #<n>`.
3. **Merge:** `gh pr merge --squash --delete-branch` (squash is the convention; merge to `main` deploys via GitHub Pages, ~1 min). **If merge is blocked** (protection/checks): STOP, leave PR + branch + issue untouched, report the blocker — steps 4–5 run only after a real merge.
4. Confirm `#<n>` closed (the `Closes #<n>` usually does it on merge; otherwise `gh issue close <n> --comment "<what was done + PR link>"`).
5. Clean up: `git switch main && git pull` so root is back on the deployed main; the branch was deleted by `--delete-branch` (else `git branch -D` + `git push origin --delete`).
If the user tweaks instead of approving, iterate on the same branch and re-present.
