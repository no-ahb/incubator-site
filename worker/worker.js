// Report-an-issue proxy (Cloudflare Worker).
//
// Receives a report from the live site and creates a GitHub issue using a
// server-held token, so reporters never need a GitHub account and the token
// never reaches the browser. Optionally uploads a screenshot to the repo and
// embeds it in the issue body.
//
// Bindings (see wrangler.toml + `wrangler secret`):
//   GITHUB_TOKEN     secret — fine-grained PAT with Issues:write (+ Contents:write
//                    if screenshots are enabled) on the target repo only.
//   REPO             var    — "owner/repo" the issues are created in.
//   ALLOWED_ORIGINS  var    — comma-separated origins allowed to call this Worker.
//   ISSUE_LABEL      var    — optional label applied to every created issue.

const GITHUB_API = "https://api.github.com";
const MAX_BODY_CHARS = 20000;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
// Reject oversized payloads before buffering. A 5 MB screenshot inflates ~33%
// as base64 and rides inside JSON, so allow generous headroom over that.
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

// Upload the screenshot to the repo's default branch under issue-assets/ and
// return a URL that renders inline in issue markdown. Best-effort: on failure
// we return null and the issue is still created without the image.
async function uploadScreenshot(env, owner, repo, dataUrl, name) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  if (!EXT_FOR_MIME[parsed.mime]) return null;

  // base64 length * 3/4 ≈ decoded byte count.
  if (parsed.base64.length * 0.75 > MAX_SCREENSHOT_BYTES) return null;

  const ext = EXT_FOR_MIME[parsed.mime];
  const safe =
    (name || "screenshot")
      .replace(/\.[^.]+$/, "") // drop any existing extension; we set our own
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40) || "screenshot";
  const path = `issue-assets/${Date.now()}-${safe}.${ext}`;

  const res = await gh(env, `/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message: `Add screenshot for issue report (${path})`,
      content: parsed.base64,
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return (data && data.content && data.content.download_url) || null;
}

async function handlePost(request, env, cors) {
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

export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin, allowed);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed." }, 405, cors);
    }
    // Fail closed: require the request's Origin to be explicitly allow-listed.
    // An empty ALLOWED_ORIGINS or a missing Origin header is rejected, so a
    // misconfigured deploy can never become an open, anonymous issue/file relay.
    if (!allowed.includes(origin)) {
      return json({ ok: false, error: "Origin not allowed." }, 403, cors);
    }

    try {
      return await handlePost(request, env, cors);
    } catch (err) {
      console.error("Unhandled error:", err && err.stack ? err.stack : err);
      return json({ ok: false, error: "Internal error." }, 500, cors);
    }
  },
};
