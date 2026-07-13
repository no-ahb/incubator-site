// Local preview server that mimics GitHub Pages routing for the built site:
// `/exhibitions/foo` -> exhibitions/foo.html, `/about` -> about.html, `/` ->
// index.html, and everything else as a static file. Lets you preview the
// prerendered pages + clean URLs exactly as they'll serve in production.
//
// Run: `node build/serve.mjs`  then open http://localhost:8000

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const PORT = process.env.PORT || 8000;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".jsx": "text/babel", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json", ".xml": "application/xml", ".txt": "text/plain",
  ".ttf": "font/ttf",
};

async function resolve(pathname) {
  const rel = decodeURIComponent(pathname.replace(/^\/+/, "")) || "index.html";
  const candidates = extname(rel)
    ? [rel]
    : [rel + ".html", join(rel, "index.html"), rel]; // GH Pages: try foo.html, foo/index.html
  for (const c of candidates) {
    const full = join(ROOT, c);
    if (!full.startsWith(ROOT)) continue; // no path traversal
    try { if ((await stat(full)).isFile()) return full; } catch { /* next */ }
  }
  return null;
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  const file = await resolve(pathname);
  if (!file) { res.writeHead(404, { "content-type": "text/html" }); return res.end("<h1>404</h1>"); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(500); res.end("500");
  }
}).listen(PORT, () => console.log(`Preview: http://localhost:${PORT}`));
