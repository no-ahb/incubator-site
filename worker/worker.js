// Incubator Worker — report-issue proxy + password-gated admin CMS.
//
// Two responsibilities, one Worker:
//   1. Report an issue (POST /)  — unchanged. Turns a site report into a GitHub
//      issue using a server-held token, optionally uploading a screenshot.
//   2. Admin CMS (POST/GET /admin/*) — lets gallery staff add/edit/hide shows
//      and view open issue reports. Every admin call must carry the correct
//      X-Admin-Password header; the Worker is the real lock (browser gating is
//      cosmetic). Shows live in data/shows.json in the repo; the Worker commits
//      changes to it via the GitHub Contents API and the static site redeploys.
//   3. End-of-show reminder (cron) — a scheduled trigger emails the gallery a
//      week before a show ends, so the next show's details get uploaded in time.
//      Inert until Email Routing + the cron are configured (see wrangler.toml).
//
// Bindings (see wrangler.toml + `wrangler secret`):
//   GITHUB_TOKEN     secret — fine-grained PAT with Issues:write + Contents:write
//                    on the target repo only.
//   ADMIN_PASSWORD   secret — shared password staff type into the /admin page.
//   REPO             var    — "owner/repo" issues + content live in.
//   ALLOWED_ORIGINS  var    — comma-separated origins allowed to call this Worker.
//   ISSUE_LABEL      var    — label applied to every created issue.
//   SEND_EMAIL       send_email binding — Cloudflare Email Routing sender used by
//                    the reminder cron (optional; reminder no-ops when absent).
//   REMINDER_FROM    var    — from address on your Email Routing domain.

import { EmailMessage } from "cloudflare:email";

const GITHUB_API = "https://api.github.com";
const MAX_BODY_CHARS = 20000;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
// Reject oversized payloads before buffering. A 5 MB image inflates ~33% as
// base64 and rides inside JSON, so allow generous headroom over that.
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const SHOWS_PATH = "data/shows.json";
// End-of-show reminder: fire this many days before a show's end date.
const REMINDER_LEAD_DAYS = 7;
const REMINDER_TO = "incubator.enquiries@gmail.com";
const ADMIN_URL = "https://no-ahb.github.io/incubator-site/#/admin";
const EXT_FOR_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function corsHeaders(origin, allowed) {
  const ok = origin && allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function gh(env, path, init) {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "incubator-report-issue",
      ...(init && init.headers),
    },
  });
}

// "data:image/png;base64,AAAA" -> { mime, base64 } | null
function parseDataUrl(value) {
  if (typeof value !== "string") return null;
  const match = /^data:([^;]+);base64,(.+)$/s.exec(value);
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

// UTF-8 <-> base64 helpers (atob/btoa are byte-oriented in Workers).
function decodeBase64Utf8(b64) {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Constant-time string compare so a wrong password can't be guessed by timing.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const ba = enc.encode(a);
  const bb = enc.encode(b);
  // Compare against a fixed-length digest of each so length never short-circuits.
  let diff = ba.length ^ bb.length;
  const len = Math.max(ba.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ba[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
}

// Upload an image (data URL) to the repo under `dir`. Reused by the screenshot
// path and the admin show-image path. Best-effort: returns null on any failure.
async function uploadImageToRepo(env, owner, repo, dataUrl, name, dir) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  if (!EXT_FOR_MIME[parsed.mime]) return null;
  // base64 length * 3/4 ≈ decoded byte count.
  if (parsed.base64.length * 0.75 > MAX_SCREENSHOT_BYTES) return null;

  const ext = EXT_FOR_MIME[parsed.mime];
  const safe =
    (name || "image")
      .replace(/\.[^.]+$/, "") // drop any existing extension; we set our own
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40) || "image";
  const path = `${dir}/${Date.now()}-${safe}.${ext}`;

  const res = await gh(env, `/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Add image ${path}`,
      content: parsed.base64,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    path,
    downloadUrl: (data && data.content && data.content.download_url) || null,
  };
}

// Back-compat wrapper for the report path: embeds the absolute raw URL so the
// image renders inside the issue markdown.
async function uploadScreenshot(env, owner, repo, dataUrl, name) {
  const r = await uploadImageToRepo(env, owner, repo, dataUrl, name || "screenshot", "issue-assets");
  return r ? r.downloadUrl : null;
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[“”"'']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Read a JSON file from the repo's default branch. Returns { sha, json }.
async function readRepoJson(env, owner, repo, path) {
  const res = await gh(env, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method: "GET",
  });
  if (res.status === 404) return { sha: null, json: null };
  if (!res.ok) throw new Error(`read ${path} failed (${res.status})`);
  const data = await res.json();
  return { sha: data.sha, json: JSON.parse(decodeBase64Utf8(data.content)) };
}

async function writeRepoJson(env, owner, repo, path, obj, sha, message) {
  const body = { message, content: encodeBase64Utf8(JSON.stringify(obj, null, 2) + "\n") };
  if (sha) body.sha = sha;
  return gh(env, `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// Read-modify-write a JSON file with a single retry on a concurrent-edit (409)
// conflict. `mutate(data)` edits `data` in place and returns either
// { message } (commit it) or { status, error } (abort with that response).
// Returns { ok: true } or { status, error } for the caller to surface.
async function commitJsonUpdate(env, owner, repo, path, mutate) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { sha, json: data } = await readRepoJson(env, owner, repo, path);
    if (!data) return { status: 500, error: `${path} not found in repo.` };

    const outcome = mutate(data);
    if (outcome.error) return { status: outcome.status, error: outcome.error };

    const res = await writeRepoJson(env, owner, repo, path, data, sha, outcome.message);
    if (res.ok) return { ok: true };
    if (res.status === 409 && attempt === 0) continue; // stale sha — reread and retry
    const detail = await res.text();
    console.error("commit failed:", res.status, detail);
    return { status: 502, error: `Could not save (${res.status}).` };
  }
  return { status: 409, error: "Save conflicted, please try again." };
}

/* ===========================================================================
   REPORT ISSUE  (POST /)  — unchanged behaviour
   =========================================================================== */
async function handleReport(request, env, cors) {
  if (!env.GITHUB_TOKEN) {
    return json({ ok: false, error: "Server not configured (missing token)." }, 500, cors);
  }
  const repoSlug = (env.REPO || "").trim();
  const [owner, repo] = repoSlug.split("/");
  if (!owner || !repo) {
    return json({ ok: false, error: "Server not configured (missing REPO)." }, 500, cors);
  }

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) {
    return json({ ok: false, error: "Payload too large." }, 413, cors);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (_) {
    return json({ ok: false, error: "Invalid JSON." }, 400, cors);
  }

  const title = String(payload.title || "").trim().slice(0, 200);
  let body = String(payload.body || "").trim();
  if (!title || !body) {
    return json({ ok: false, error: "Title and description are required." }, 400, cors);
  }
  if (body.length > MAX_BODY_CHARS) body = body.slice(0, MAX_BODY_CHARS);

  if (payload.screenshot) {
    const url = await uploadScreenshot(env, owner, repo, payload.screenshot, payload.screenshotName);
    if (url) body = `![screenshot](${url})\n\n${body}`;
  }

  const issueBody = { title, body };
  const label = (env.ISSUE_LABEL || "").trim();
  if (label) issueBody.labels = [label];

  const res = await gh(env, `/repos/${owner}/${repo}/issues`, {
    method: "POST",
    body: JSON.stringify(issueBody),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("GitHub issue create failed:", res.status, detail);
    return json({ ok: false, error: `Could not create issue (${res.status}).` }, 502, cors);
  }

  const issue = await res.json();
  return json({ ok: true, url: issue.html_url, number: issue.number }, 200, cors);
}

/* ===========================================================================
   ADMIN  (POST/GET /admin/*)  — password-gated
   =========================================================================== */

// Returns null when authorised, or a Response when it should be rejected.
function requireAdmin(request, env, cors) {
  if (!env.ADMIN_PASSWORD) {
    return json({ ok: false, error: "Admin not configured (missing ADMIN_PASSWORD)." }, 500, cors);
  }
  const provided = request.headers.get("X-Admin-Password") || "";
  if (!safeEqual(provided, env.ADMIN_PASSWORD)) {
    return json({ ok: false, error: "Incorrect password." }, 401, cors);
  }
  return null;
}

function adminRepo(env) {
  const [owner, repo] = (env.REPO || "").trim().split("/");
  return { owner, repo };
}

// Auth + REPO config gate shared by the write/read admin handlers. Returns
// { owner, repo } when good, or { error: Response } to return immediately.
function adminGate(request, env, cors) {
  const denied = requireAdmin(request, env, cors);
  if (denied) return { error: denied };
  const { owner, repo } = adminRepo(env);
  if (!owner || !repo) {
    return { error: json({ ok: false, error: "Server not configured (missing REPO)." }, 500, cors) };
  }
  return { owner, repo };
}

// Parse a JSON body, returning { payload } or { error: Response }.
async function readJsonBody(request, cors) {
  try {
    return { payload: await request.json() };
  } catch (_) {
    return { error: json({ ok: false, error: "Invalid JSON." }, 400, cors) };
  }
}

// POST /admin/login — validate password only (used to gate the UI).
async function handleAdminLogin(request, env, cors) {
  const denied = requireAdmin(request, env, cors);
  if (denied) return denied;
  return json({ ok: true }, 200, cors);
}

// POST /admin/upload — upload one image, return its repo-relative path.
// Body: { image: dataURL, name, showId }.
async function handleAdminUpload(request, env, cors) {
  const gate = adminGate(request, env, cors);
  if (gate.error) return gate.error;
  const { owner, repo } = gate;

  const declaredLength = Number(request.headers.get("Content-Length") || 0);
  if (declaredLength > MAX_REQUEST_BYTES) return json({ ok: false, error: "Image too large." }, 413, cors);

  const body = await readJsonBody(request, cors);
  if (body.error) return body.error;
  const payload = body.payload;

  const showId = slugify(payload.showId) || "misc";
  const result = await uploadImageToRepo(env, owner, repo, payload.image, payload.name, `assets/shows/${showId}`);
  if (!result) {
    return json({ ok: false, error: "Upload failed (unsupported type, too large, or commit error)." }, 400, cors);
  }
  return json({ ok: true, path: result.path }, 200, cors);
}

// Canonical, whitelist-only sanitiser for rich text (press releases & bios).
// The admin editor already emits a clean canonical string; this is the trust
// boundary that also defends against a hand-crafted POST (e.g. if the admin
// password leaks). Without a DOM we tokenise tags and re-emit *canonical
// literals* only — attacker-controlled attribute text is never passed through,
// so the output can only ever contain <p>/<blockquote>/<strong>/<em>/<br> plus
// text. Allowed <p> classes: attrib, byline, indent. The public renderer
// re-canonicalises again, so this is defence in depth.
const RICH_BLOCK_TAGS = { p: "p", div: "p", blockquote: "blockquote", h1: "p", h2: "p", h3: "p", h4: "p", h5: "p", h6: "p", li: "p" };
const RICH_INLINE_TAGS = { strong: "strong", b: "strong", em: "em", i: "em" };
function richClassAttr(tagText) {
  const m = /class\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tagText);
  if (!m) return "";
  const v = (m[2] || m[3] || m[4] || "").toLowerCase();
  const cls = /\b(attrib|byline|indent)\b/.exec(v);
  return cls ? ' class="' + cls[1] + '"' : "";
}
function sanitizeRichHtml(input) {
  const s = String(input == null ? "" : input);
  let out = "";
  const re = /<[^>]*>/g;
  let last = 0, m;
  const emitText = (t) => { if (t) out += t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  while ((m = re.exec(s))) {
    emitText(s.slice(last, m.index));
    last = re.lastIndex;
    const tagText = m[0];
    const tm = /^<\s*(\/?)\s*([a-zA-Z0-9]+)/.exec(tagText);
    if (!tm) continue; // comment / doctype / stray "<>" → drop
    const closing = tm[1] === "/";
    const name = tm[2].toLowerCase();
    if (name === "br") { if (!closing) out += "<br>"; continue; }
    if (RICH_INLINE_TAGS[name]) { out += closing ? "</" + RICH_INLINE_TAGS[name] + ">" : "<" + RICH_INLINE_TAGS[name] + ">"; continue; }
    if (RICH_BLOCK_TAGS[name]) {
      const tag = RICH_BLOCK_TAGS[name];
      out += closing ? "</" + tag + ">" : "<" + tag + (tag === "p" ? richClassAttr(tagText) : "") + ">";
      continue;
    }
    // any other tag (script, img, style, a, on*-bearing, …) is dropped entirely
  }
  emitText(s.slice(last));
  return out.trim();
}

// Accept rich text as either the new canonical HTML string (sanitised) or the
// legacy array of plain paragraph strings (kept as-is for un-migrated content).
function normalizeRich(value) {
  if (typeof value === "string") return sanitizeRichHtml(value);
  if (Array.isArray(value)) return value.filter((p) => typeof p === "string" && p.trim()).map((p) => p.trim());
  return "";
}

// Build a clean show entry from posted fields, preserving the field shape the
// site reads. Unknown fields are dropped.
function normalizeShow(input) {
  // Group shows have no single artist: the title names the show and the
  // participant list carries the artists, so there's no per-artist page to key.
  const isGroup = !!input.isGroup;
  const title = String(input.title || "").trim();
  // A group show has no single artist; fall back to the title so the field is
  // never empty (the site uses `artist` as a display fallback).
  const artist = String(input.artist || "").trim() || (isGroup ? title : "");
  const id = slugify(input.id) || slugify(isGroup ? title : artist + " " + title);
  const artistId = isGroup ? null : (slugify(input.artistId) || slugify(artist));

  // Rich text: new canonical HTML string, or legacy plain-paragraph array.
  const pressRelease = normalizeRich(input.pressRelease);

  const installation = Array.isArray(input.installation)
    ? input.installation.filter((s) => typeof s === "string" && s)
    : [];

  const show = {
    id,
    artistId,
    artist,
    title,
    dates: String(input.dates || "").trim(),
    startISO: String(input.startISO || "").trim(),
    endISO: String(input.endISO || "").trim(),
    // No "current" pin: the home page now picks the lead show purely by date, so
    // the flag is obsolete and deliberately not stored (#90).
    palette: String(input.palette || "sap").trim() || "sap",
    pressRelease,
    installation,
  };
  if (isGroup) {
    show.isGroup = true;
    show.groupArtists = Array.isArray(input.groupArtists)
      ? input.groupArtists.map((s) => String(s).trim()).filter(Boolean)
      : [];
  }
  if (input.privateView) show.privateView = String(input.privateView).trim();
  if (input.heroImage) show.heroImage = String(input.heroImage).trim();
  // Visibility is managed solely via /admin/visibility, never the show form, so
  // `hidden` is deliberately not read here — save-show preserves the prior flag.
  return show;
}

// POST /admin/save-show — create or update a show (and upsert its artist).
// Body: { show: {...fields}, artistBio?: string|string[] }.
async function handleAdminSaveShow(request, env, cors) {
  const gate = adminGate(request, env, cors);
  if (gate.error) return gate.error;
  const { owner, repo } = gate;

  const body = await readJsonBody(request, cors);
  if (body.error) return body.error;
  const payload = body.payload;

  const show = normalizeShow(payload.show || {});
  // Solo shows may be announced before they have a title (#125); group shows
  // are named by their title.
  if (show.isGroup ? !show.title : !show.artist) {
    return json({ ok: false, error: show.isGroup ? "A group show needs a title." : "Artist is required." }, 400, cors);
  }

  // Rich text: new canonical HTML string, or legacy plain-paragraph array.
  const bio = normalizeRich(payload.artistBio);
  const bioHasContent = !!bio && bio.length > 0; // string or array both use .length

  const result = await commitJsonUpdate(env, owner, repo, SHOWS_PATH, (data) => {
    data.exhibitions = Array.isArray(data.exhibitions) ? data.exhibitions : [];
    data.artists = Array.isArray(data.artists) ? data.artists : [];

    const idx = data.exhibitions.findIndex((e) => e.id === show.id);
    const prevArtistId = idx >= 0 ? data.exhibitions[idx].artistId : null;
    if (idx >= 0) {
      // Editing: always carry the prior hidden flag (the form never sets it).
      const merged = { ...data.exhibitions[idx], ...show };
      if (data.exhibitions[idx].hidden) merged.hidden = true;
      // normalizeShow only emits the group fields for a group show, so a
      // group→solo edit would otherwise keep the stale flags from the merge.
      if (!show.isGroup) { delete merged.isGroup; delete merged.groupArtists; }
      data.exhibitions[idx] = merged;
    } else {
      data.exhibitions.unshift(show);
    }

    // Upsert the artist record so the artist page + link work. Group shows have
    // no single artist (artistId is null), so there's nothing to upsert.
    if (show.artistId) {
      const aIdx = data.artists.findIndex((a) => a.id === show.artistId);
      if (aIdx >= 0) {
        if (bioHasContent) data.artists[aIdx].bio = bio;
        if (!data.artists[aIdx].name) data.artists[aIdx].name = show.artist;
      } else {
        data.artists.push({ id: show.artistId, name: show.artist, bio: bioHasContent ? bio : [] });
      }
    }

    // If this edit moved the show off its old artist (solo→group, or an artist
    // rename), drop the now-orphaned artist record when no show references it —
    // otherwise a direct /artists/<id> URL would resolve to a dead page.
    if (prevArtistId && prevArtistId !== show.artistId &&
        !data.exhibitions.some((e) => e.artistId === prevArtistId)) {
      data.artists = data.artists.filter((a) => a.id !== prevArtistId);
    }

    return { message: `Admin: save show "${show.title}"` };
  });

  if (result.error) return json({ ok: false, error: result.error }, result.status, cors);
  return json({ ok: true, id: show.id }, 200, cors);
}

/* ---------------------------------------------------------------------------
   PAGE CONTENT (About / Contact / Press) — admin-editable singletons + list.
   Each normaliser keeps only the fields the site reads and coerces types, so a
   malformed post can't corrupt shows.json. Mirrors normalizeShow().
   ------------------------------------------------------------------------- */
function strArray(v) {
  if (Array.isArray(v)) return v.map((s) => String(s).trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function normalizeAbout(input) {
  const src = input && typeof input === "object" ? input : {};
  const team = Array.isArray(src.team)
    ? src.team
        .map((m) => ({ name: String((m && m.name) || "").trim(), role: String((m && m.role) || "").trim() }))
        .filter((m) => m.name || m.role)
    : [];
  return {
    // Paragraphs may arrive as an array or a blank-line-separated string.
    paragraphs: typeof src.paragraphs === "string"
      ? src.paragraphs.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
      : strArray(src.paragraphs),
    image: String(src.image || "").trim(),
    team,
  };
}

function normalizeContact(input) {
  const src = input && typeof input === "object" ? input : {};
  const s = (k) => String(src[k] || "").trim();
  return {
    addressLines: strArray(src.addressLines),
    hours: strArray(src.hours),
    enquiriesEmail: s("enquiriesEmail"),
    pressEmail: s("pressEmail"),
    internshipText: s("internshipText"),
    instagramUrl: s("instagramUrl"),
    instagramHandle: s("instagramHandle"),
    mailingListUrl: s("mailingListUrl"),
    mapQuery: s("mapQuery"),
    mapCaption: s("mapCaption"),
  };
}

function normalizePress(input) {
  if (!Array.isArray(input)) return [];
  return input
    .map((group) => {
      const year = parseInt((group && group.year) || 0, 10) || 0;
      const items = Array.isArray(group && group.items)
        ? group.items
            .map((it) => ({
              pub: String((it && it.pub) || "").trim(),
              title: String((it && it.title) || "").trim(),
              href: String((it && it.href) || "").trim(),
            }))
            .filter((it) => it.title || it.pub || it.href)
        : [];
      return { year, items };
    })
    .filter((g) => g.year && g.items.length)
    // Merge groups sharing a year so saved data stays canonical — one heading
    // per year on the Press page (#110).
    .reduce((acc, g) => {
      const prev = acc.find((x) => x.year === g.year);
      if (prev) prev.items.push(...g.items);
      else acc.push(g);
      return acc;
    }, [])
    .sort((a, b) => b.year - a.year);
}

// POST /admin/save-content — update any of { about, contact, press } in one
// commit. Only the keys present in the body are written.
async function handleAdminSaveContent(request, env, cors) {
  const gate = adminGate(request, env, cors);
  if (gate.error) return gate.error;
  const { owner, repo } = gate;

  const body = await readJsonBody(request, cors);
  if (body.error) return body.error;
  const payload = body.payload || {};

  const hasAbout = Object.prototype.hasOwnProperty.call(payload, "about");
  const hasContact = Object.prototype.hasOwnProperty.call(payload, "contact");
  const hasPress = Object.prototype.hasOwnProperty.call(payload, "press");
  if (!hasAbout && !hasContact && !hasPress) {
    return json({ ok: false, error: "Nothing to save." }, 400, cors);
  }

  const result = await commitJsonUpdate(env, owner, repo, SHOWS_PATH, (data) => {
    const sections = [];
    if (hasAbout) { data.about = normalizeAbout(payload.about); sections.push("about"); }
    if (hasContact) { data.contact = normalizeContact(payload.contact); sections.push("contact"); }
    if (hasPress) { data.press = normalizePress(payload.press); sections.push("press"); }
    return { message: `Admin: update ${sections.join(", ")}` };
  });

  if (result.error) return json({ ok: false, error: result.error }, result.status, cors);
  return json({ ok: true }, 200, cors);
}

// POST /admin/visibility — { id, hidden:boolean }.
async function handleAdminVisibility(request, env, cors) {
  const gate = adminGate(request, env, cors);
  if (gate.error) return gate.error;
  const { owner, repo } = gate;

  const body = await readJsonBody(request, cors);
  if (body.error) return body.error;
  const payload = body.payload;

  const id = slugify(payload.id);
  const hidden = !!payload.hidden;
  if (!id) return json({ ok: false, error: "Missing show id." }, 400, cors);

  const result = await commitJsonUpdate(env, owner, repo, SHOWS_PATH, (data) => {
    const list = Array.isArray(data.exhibitions) ? data.exhibitions : [];
    const idx = list.findIndex((e) => e.id === id);
    if (idx < 0) return { status: 404, error: "Show not found." };
    if (hidden) list[idx].hidden = true;
    else delete list[idx].hidden;
    return { message: `Admin: ${hidden ? "hide" : "unhide"} "${list[idx].title}"` };
  });

  if (result.error) return json({ ok: false, error: result.error }, result.status, cors);
  return json({ ok: true, id, hidden }, 200, cors);
}

// GET /admin/issues — list open reported issues.
async function handleAdminIssues(request, env, cors) {
  const gate = adminGate(request, env, cors);
  if (gate.error) return gate.error;
  const { owner, repo } = gate;

  const label = (env.ISSUE_LABEL || "").trim();
  const q = `state=open&per_page=50&sort=created&direction=desc` + (label ? `&labels=${encodeURIComponent(label)}` : "");
  const res = await gh(env, `/repos/${owner}/${repo}/issues?${q}`, { method: "GET" });
  if (!res.ok) {
    const detail = await res.text();
    console.error("issues list failed:", res.status, detail);
    return json({ ok: false, error: `Could not list issues (${res.status}).` }, 502, cors);
  }
  const raw = await res.json();
  const issues = (Array.isArray(raw) ? raw : [])
    .filter((it) => !it.pull_request) // the issues endpoint also returns PRs
    .map((it) => ({
      number: it.number,
      title: it.title,
      url: it.html_url,
      createdAt: it.created_at,
      comments: it.comments,
    }));
  return json({ ok: true, issues }, 200, cors);
}

/* ===========================================================================
   END-OF-SHOW REMINDER  (cron)  — email a week before a show ends
   =========================================================================== */

// ISO date (YYYY-MM-DD) n days from now, UTC.
function isoDaysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Strip CR/LF so an interpolated value can't inject extra email headers.
function headerSafe(s) {
  return String(s).replace(/[\r\n]+/g, " ").trim();
}

// Minimal RFC 5322 message. CRLF line endings; blank line before the body.
function buildReminderMime(from, to, subject, body) {
  const domain = headerSafe(from.split("@")[1] || "incubator.local");
  return [
    `From: Incubator <${headerSafe(from)}>`,
    `To: ${headerSafe(to)}`,
    `Subject: ${headerSafe(subject)}`,
    `Message-ID: <${Date.now()}.reminder@${domain}>`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "",
    body,
  ].join("\r\n");
}

// Runs on the cron trigger: if a visible show ends in exactly REMINDER_LEAD_DAYS,
// email the gallery so the next show's details get uploaded in time. No-ops
// unless Email Routing (SEND_EMAIL) and REMINDER_FROM are configured.
// Assumes a single daily cron run: the exact-day match sends once (no de-dup
// state), so keep the crons entry to one run per day. A dropped run means that
// day's reminder is missed — acceptable for a low-stakes nudge.
async function handleScheduled(env) {
  const from = (env.REMINDER_FROM || "").trim();
  if (!env.SEND_EMAIL || !from || !env.GITHUB_TOKEN) return;
  const { owner, repo } = adminRepo(env);
  if (!owner || !repo) return;

  let data;
  try {
    ({ json: data } = await readRepoJson(env, owner, repo, SHOWS_PATH));
  } catch (err) {
    console.error("Reminder: could not read shows.json:", err && err.message ? err.message : err);
    return;
  }
  const shows = data && Array.isArray(data.exhibitions) ? data.exhibitions : [];
  const target = isoDaysFromNow(REMINDER_LEAD_DAYS);
  const ending = shows.filter((e) => !e.hidden && e.endISO === target);

  for (const show of ending) {
    const name = show.title || show.artist || "the current exhibition";
    const when = show.dates || target;
    const subject = `Reminder: “${name}” ends ${when} — upload the next show`;
    const body =
      `“${name}” ends on ${when} (in ${REMINDER_LEAD_DAYS} days).\n\n` +
      `Please add the next exhibition's details on the admin page so the site ` +
      `switches over in time:\n${ADMIN_URL}\n\n` +
      `Until the next show is published, the site will label this one ` +
      `“Most recent exhibition”.\n`;
    try {
      await env.SEND_EMAIL.send(
        new EmailMessage(from, REMINDER_TO, buildReminderMime(from, REMINDER_TO, subject, body))
      );
      console.log(`Reminder sent for "${name}" (ends ${when}).`);
    } catch (err) {
      console.error("Reminder email failed:", err && err.message ? err.message : err);
    }
  }
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },

  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, allowed);
    const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Fail closed: require the request's Origin to be explicitly allow-listed.
    // An empty ALLOWED_ORIGINS or a missing Origin header is rejected, so a
    // misconfigured deploy can never become an open, anonymous relay.
    if (!allowed.includes(origin)) {
      return json({ ok: false, error: "Origin not allowed." }, 403, cors);
    }

    try {
      // Admin routes.
      if (path === "/admin/login" && request.method === "POST") return await handleAdminLogin(request, env, cors);
      if (path === "/admin/upload" && request.method === "POST") return await handleAdminUpload(request, env, cors);
      if (path === "/admin/save-show" && request.method === "POST") return await handleAdminSaveShow(request, env, cors);
      if (path === "/admin/save-content" && request.method === "POST") return await handleAdminSaveContent(request, env, cors);
      if (path === "/admin/visibility" && request.method === "POST") return await handleAdminVisibility(request, env, cors);
      if (path === "/admin/issues" && request.method === "GET") return await handleAdminIssues(request, env, cors);

      // Report-issue (default): any POST to the root path.
      if (path === "/" && request.method === "POST") return await handleReport(request, env, cors);

      return json({ ok: false, error: "Not found." }, 404, cors);
    } catch (err) {
      console.error("Unhandled error:", err && err.stack ? err.stack : err);
      return json({ ok: false, error: "Internal error." }, 500, cors);
    }
  },
};
