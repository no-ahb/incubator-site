// Incubator — static prerender / SEO build.
//
// Emits one real HTML file per route from data/shows.json so search engines and
// AI crawlers (which mostly do NOT run JavaScript) see the full page content,
// titles, meta, Open Graph and JSON-LD. The existing React SPA still boots on
// top for human visitors — app.jsx waits for the data load before its first
// mount, then swaps the prerendered #root for the live app in one step, so
// there is no loading flash. Pages are emitted as flat `.html` files so GitHub
// Pages serves clean, no-trailing-slash URLs (e.g. /exhibitions/foo →
// exhibitions/foo.html) with no redirect, matching the canonical URLs.
//
// Run: `node build/prerender.mjs`  (also runs in CI on every push, see
// .github/workflows/prerender.yml). Zero dependencies — Node stdlib only.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE_URL = "https://incubatorart.com"; // canonical origin (no trailing slash)
const SITE_NAME = "Incubator";
const DEFAULT_OG = SITE_URL + "/assets/about-image.jpg";

const RAW = readFileSync(join(ROOT, "data/shows.json"), "utf8");
const DATA = JSON.parse(RAW);
const EXHIBITIONS = (DATA.exhibitions || []).filter((e) => !e.hidden);
const ARCHIVE = (DATA.archive || []).filter((e) => !e.hidden);
const ARTISTS = DATA.artists || [];
const PRESS = DATA.press || [];
const ALL_SHOWS = [...EXHIBITIONS, ...ARCHIVE];
const TODAY = new Date().toISOString().slice(0, 10);

// About / Contact are admin-editable (data.about / data.contact). These defaults
// and resolvers MUST match js/screens.jsx (DEFAULT_ABOUT / DEFAULT_CONTACT /
// resolveContact) so the prerendered pages match what the live app renders.
const DEFAULT_ABOUT = {
  paragraphs: [
    "Incubator is a London-based gallery dedicated to championing exceptional emerging artists. Since its founding in 2021, the gallery has established itself as a platform for ambitious, innovative voices in contemporary art.",
    "Incubator presented the work of 42 artists in its first three years, earning a reputation for identifying and championing compelling new voices. Today, the gallery continues to provide a platform for emerging artists to engage new audiences and advance their artistic practices.",
    "As a carbon-neutral organisation and member of the Gallery Climate Coalition, Incubator is committed to embedding sustainability across its operations. The gallery continually reviews its practices to minimise environmental impact and contribute to a more sustainable future for the arts.",
  ],
  image: "assets/about-image.jpg",
  team: [
    { name: "Angelica Jopling", role: "Founding Director" },
    { name: "Isabella Mackintosh", role: "Gallery Manager" },
  ],
};
const DEFAULT_CONTACT = {
  addressLines: ["2 Chiltern street", "Marylebone, W1U 7PR"],
  hours: ["Mon – Wed, appointment only", "Thur – Sat, 11am – 6pm", "Sun, 11am – 5pm"],
  enquiriesEmail: "incubator.enquiries@gmail.com",
  pressEmail: "fabian@strobellall.com",
  internshipText: "Incubator is unable to accept unsolicited artist submissions. We offer a number of internship opportunities throughout the year. Please send your resume and a cover letter to incubator.enquiries@gmail.com.",
  instagramUrl: "https://www.instagram.com/__incubator__/",
  instagramHandle: "@__incubator__",
  mailingListUrl: "https://first-thursday.typeform.com/incubator",
  mapQuery: "2 Chiltern Street London W1U 7PR",
  mapCaption: "Nearest tube — Baker Street (5 minutes' walk) · Marylebone (8 minutes)",
};
function resolveAbout(a) {
  const about = a && typeof a === "object" ? a : {};
  return {
    paragraphs: Array.isArray(about.paragraphs) && about.paragraphs.length ? about.paragraphs : DEFAULT_ABOUT.paragraphs,
    image: about.image || DEFAULT_ABOUT.image,
    team: (Array.isArray(about.team) ? about.team : DEFAULT_ABOUT.team).filter((m) => m && m.name),
  };
}
function resolveContact(c0) {
  const c = c0 && typeof c0 === "object" ? c0 : {};
  const pick = (v, d) => (v === undefined || v === null || v === "" ? d : v);
  const arr = (v, d) => (Array.isArray(v) && v.length ? v : d);
  return {
    addressLines: arr(c.addressLines, DEFAULT_CONTACT.addressLines),
    hours: arr(c.hours, DEFAULT_CONTACT.hours),
    enquiriesEmail: pick(c.enquiriesEmail, DEFAULT_CONTACT.enquiriesEmail),
    pressEmail: pick(c.pressEmail, DEFAULT_CONTACT.pressEmail),
    internshipText: pick(c.internshipText, DEFAULT_CONTACT.internshipText),
    instagramUrl: pick(c.instagramUrl, DEFAULT_CONTACT.instagramUrl),
    instagramHandle: pick(c.instagramHandle, DEFAULT_CONTACT.instagramHandle),
    mailingListUrl: pick(c.mailingListUrl, DEFAULT_CONTACT.mailingListUrl),
    mapQuery: pick(c.mapQuery, DEFAULT_CONTACT.mapQuery),
    mapCaption: pick(c.mapCaption, DEFAULT_CONTACT.mapCaption),
  };
}
const RABOUT = resolveAbout(DATA.about);
const RCONTACT = resolveContact(DATA.contact);

/* ---------- text helpers (mirror js/components.jsx Prose) ----------------- */
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ESC[c]);
const emphasis = (s) => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");
const proseHtml = (paras = []) =>
  `<div class="inc-prose">${paras.map((p) => `<p>${emphasis(p)}</p>`).join("")}</div>`;

// Plain text (no markup, no emphasis markers) for meta descriptions.
const plain = (s) => String(s || "").replace(/\*/g, "").replace(/\s+/g, " ").trim();
function clip(text, n = 155) {
  const t = plain(text);
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const sp = cut.lastIndexOf(" ");
  return (sp > 40 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, "") + "…";
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const monthName = (iso) => MONTHS[parseInt(iso.slice(5, 7), 10) - 1];

// Absolute URL for an asset path stored relative in shows.json.
const abs = (u) => (!u ? "" : /^https?:\/\//.test(u) ? u : SITE_URL + "/" + u.replace(/^\//, ""));

function slug(name) {
  return String(name).toLowerCase()
    .replace(/[“”"'']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ---------- status label (mirror screens.jsx exhibitionStatus) ------------ */
function statusLabel(ex, { heroFallback = false } = {}) {
  const started = ex.startISO && ex.startISO <= TODAY;
  const ended = ex.endISO && ex.endISO < TODAY;
  if (started && !ended) return "Current exhibition";
  if (ex.startISO && ex.startISO > TODAY) return "Forthcoming";
  return heroFallback ? "Most recent exhibition" : "Past exhibition";
}

/* ---------- shared render bits -------------------------------------------- */
function posterHtml(ex, size = "card") {
  if (ex.heroImage) {
    const alt = ex.title ? (ex.artist ? `${ex.artist} — ${ex.title}` : ex.title) : "Exhibition";
    return `<div class="inc-poster inc-poster--${size} inc-poster--photo"><img class="inc-poster__img" src="${esc(ex.heroImage)}" alt="${esc(alt)}" loading="lazy"></div>`;
  }
  const title = ex.title ? (ex.isGroup ? esc(ex.title) : `<em>${esc(ex.title)}</em>`) : "";
  return `<div class="inc-poster inc-poster--${size} palette palette--${esc(ex.palette || "sap")}"><span class="inc-poster__wm">INCUBATOR</span><span class="inc-poster__title">${title}</span><span class="inc-poster__addr">2&nbsp;CHILTERN&nbsp;STREET, LONDON, W1U&nbsp;7PR</span></div>`;
}

// Heading text for a show: "Artist: Title" (solo) or "Title" (group).
function showHeading(ex) {
  if (ex.isGroup) return ex.title ? `<em>${esc(ex.title)}</em>` : esc(ex.artist || "Group show");
  const t = ex.title ? `: <em>${esc(ex.title)}</em>` : "";
  return `${esc(ex.artist || "")}${t}`;
}
function showPlainTitle(ex) {
  if (ex.isGroup) return ex.title || ex.artist || "Group show";
  return [ex.artist, ex.title].filter(Boolean).join(": ");
}

function installationHtml(ex) {
  const frames = ex.installation || [];
  if (!frames.length) return "";
  const imgs = frames
    .map((f, i) => (/^https?:|\//.test(f) || /\.(jpe?g|png|webp|avif)$/i.test(f))
      ? `<img class="inc-tile inc-tile--photo" src="${esc(f)}" alt="Installation view ${i + 1}" loading="lazy">`
      : "")
    .filter(Boolean).join("");
  if (!imgs) return "";
  return `<section id="installation" class="container inc-detail__installation"><h3>Installation views</h3><div class="inc-strip">${imgs}</div></section>`;
}

/* ---------- resolvers (mirror the screens' cross-referencing) ------------- */
function artistShows(artist) {
  const nm = (artist.name || "").trim().toLowerCase();
  return EXHIBITIONS
    .filter((e) => e.artistId === artist.id ||
      (e.isGroup && (e.groupArtists || []).some((n) => slug(n) === artist.id || (nm && n.trim().toLowerCase() === nm))))
    .sort((a, b) => (b.startISO || "").localeCompare(a.startISO || ""));
}
function otherShowsFor(ex) {
  if (ex.isGroup || !ex.artistId) return [];
  const nm = (ex.artist || "").trim().toLowerCase();
  return ALL_SHOWS
    .filter((e) => e.id !== ex.id && (e.artistId === ex.artistId ||
      (e.isGroup && (e.groupArtists || []).some((n) => slug(n) === ex.artistId || (nm && n.trim().toLowerCase() === nm)))))
    .sort((a, b) => (b.startISO || "").localeCompare(a.startISO || ""));
}

/* ====================================================================== */
/*  PAGE BODIES (prerendered #root content)                               */
/* ====================================================================== */
function homeBody() {
  const started = EXHIBITIONS.filter((e) => (e.startISO || "") <= TODAY)
    .sort((a, b) => (b.startISO || "").localeCompare(a.startISO || ""));
  const onView = started.filter((e) => !e.endISO || e.endISO >= TODAY);
  // Dates decide the lead show (matches screens.jsx — no admin "current" pin).
  const current = onView[0] || started[0] || EXHIBITIONS[0];
  if (!current) {
    return `<main class="inc-main"><section class="inc-section container"><header class="inc-section__head"><h2>Exhibitions</h2></header><p class="inc-prose">No exhibitions are on view at the moment. Please check back soon.</p></section></main>`;
  }
  const next = EXHIBITIONS.filter((e) => e.id !== current.id && (e.startISO || "") > TODAY)
    .sort((a, b) => (a.startISO || "").localeCompare(b.startISO || ""))[0];
  const past = ALL_SHOWS.filter((e) => e.id !== current.id && (!next || e.id !== next.id))
    .sort((a, b) => (b.startISO || "").localeCompare(a.startISO || "")).slice(0, 8);

  const hero = `<section class="inc-hero"><a class="inc-hero__media" href="/exhibitions/${esc(current.id)}">${posterHtml(current, "hero")}</a><div class="container inc-hero__meta"><span class="inc-eyebrow">${statusLabel(current, { heroFallback: true })}</span><h1 class="inc-hero__title"><a href="/exhibitions/${esc(current.id)}">${showHeading(current)}</a></h1><div class="inc-meta">${esc(current.dates)}</div><a class="inc-hero__cta" href="/exhibitions/${esc(current.id)}">Read more →</a></div></section>`;

  const forthcoming = next
    ? `<section class="inc-section container"><header class="inc-section__head"><h2>Forthcoming</h2></header><div class="inc-coming"><a href="/exhibitions/${esc(next.id)}" class="inc-card">${posterHtml(next, "card")}</a><div class="inc-coming__meta"><span class="inc-eyebrow">Opening ${next.startISO.slice(8, 10)} ${monthName(next.startISO)}</span><h3 class="inc-hero__title">${showHeading(next)}</h3><div class="inc-meta">${esc(next.dates)}</div><a class="inc-hero__cta" href="/exhibitions/${esc(next.id)}">Read more →</a></div></div></section>`
    : "";

  const pastCards = past.map((ex) => `<a class="inc-card" href="/exhibitions/${esc(ex.id)}">${posterHtml(ex, "card")}<div class="inc-card__meta"><span class="inc-card__dates">${esc(ex.dates)}</span></div><h3 class="inc-card__title">${showHeading(ex)}</h3></a>`).join("");
  const pastSection = `<section class="inc-section container"><header class="inc-section__head"><h2>Past exhibitions</h2><a href="/exhibitions">View all</a></header><div class="inc-past">${pastCards}</div></section>`;

  return `<main class="inc-main">${hero}${forthcoming}${pastSection}</main>`;
}

function listBody() {
  const xs = ALL_SHOWS.slice().sort((a, b) => (b.startISO || "").localeCompare(a.startISO || ""));
  const rows = xs.map((ex) => {
    const name = ex.isGroup ? (ex.title || ex.artist) : ex.artist;
    const work = ex.isGroup ? "" : (ex.title ? `<em class="inc-list__work">${esc(ex.title)}</em>` : "");
    return `<li class="inc-list__row"><a class="inc-list__link" href="/exhibitions/${esc(ex.id)}"><span class="inc-list__title"><span class="inc-list__name">${esc(name)}</span>${work}</span><span class="inc-list__dates">${esc(ex.dates)}</span></a></li>`;
  }).join("");
  return `<main class="inc-main"><div class="container"><header class="inc-pagehead"><h1>Exhibitions</h1></header><p class="inc-listbar__count">${xs.length} exhibitions</p><div class="inc-list"><div class="inc-list__col"><ul class="inc-list__items">${rows}</ul></div></div></div></main>`;
}

function exhibitionBody(ex) {
  const artistRec = !ex.isGroup ? ARTISTS.find((a) => a.id === ex.artistId) : null;
  const h1 = ex.isGroup
    ? `<em>${esc(ex.title)}</em>`
    : `${artistRec ? `<a href="/artists/${esc(ex.artistId)}">${esc(ex.artist)}</a>` : esc(ex.artist)}${ex.title ? `: <em>${esc(ex.title)}</em>` : ""}`;

  let participants = "";
  if (ex.isGroup && (ex.groupArtists || []).length) {
    const names = ex.groupArtists.map((n) => {
      const rec = ARTISTS.find((a) => a.id === slug(n) || (a.name || "").trim().toLowerCase() === n.trim().toLowerCase());
      return rec ? `<a href="/artists/${esc(rec.id)}">${esc(n)}</a>` : esc(n);
    }).join(", ");
    participants = `<div class="inc-participants"><span class="inc-participants__label">Artists</span> <span class="inc-participants__names">${names}</span></div>`;
  }

  const release = (ex.pressRelease || []).length
    ? `<section id="release" class="container inc-detail__release"><h3>Press release</h3>${proseHtml(ex.pressRelease)}</section>` : "";

  const others = otherShowsFor(ex);
  const related = others.length
    ? `<section class="container inc-related"><h3>Other exhibitions featuring ${esc(ex.artist)} at Incubator</h3><div class="inc-related__items">${others.map((o) => `<div class="inc-related__row"><a class="inc-related__link" href="/exhibitions/${esc(o.id)}"><span class="inc-related__title">${o.title ? `<em>${esc(o.title)}</em>` : esc(o.artist || "Untitled")}${o.isGroup ? ' <span class="inc-related__tag">— Group show</span>' : ""}</span> <span class="inc-related__dates">${esc(o.dates)}</span></a></div>`).join("")}</div></section>`
    : "";

  return `<main class="inc-main"><article class="inc-detail">${posterHtml(ex, "hero")}<div class="container inc-detail__head"><span class="inc-eyebrow">${statusLabel(ex)}${ex.isGroup ? " · Group show" : ""}</span><h1>${h1}</h1><div class="inc-meta">${esc(ex.dates)}</div>${participants}</div>${installationHtml(ex)}${release}${related}<p class="container inc-back"><a href="/exhibitions">← Back to exhibitions</a></p></article></main>`;
}

function artistBody(artist) {
  const shows = artistShows(artist);
  const heroShow = shows.find((e) => !e.isGroup) || shows[0];
  const showBlocks = shows.map((ex, idx) => {
    const meta = `${ex.isGroup ? "Group show" : "Solo show"} · ${esc(ex.dates)} · <a href="/exhibitions/${esc(ex.id)}">View exhibition →</a>`;
    return `<div class="inc-detail__show ${idx > 0 ? "is-sub" : ""}"><header class="container inc-detail__show-head">${ex.title ? `<h2><em>${esc(ex.title)}</em></h2>` : ""}<div class="inc-detail__show-meta">${meta}</div></header>${installationHtml(ex)}</div>`;
  }).join("");
  return `<main class="inc-main"><article class="inc-detail">${posterHtml(heroShow, "hero")}<div class="container inc-detail__head"><span class="inc-eyebrow">Artist</span><h1>${esc(artist.name)}</h1></div>${showBlocks}<section id="biography" class="container inc-detail__bio"><h3>Biography</h3>${proseHtml(artist.bio || [])}</section><p class="container inc-back"><a href="/exhibitions">← Back to exhibitions</a></p></article></main>`;
}

function pressBody() {
  const ordered = [...PRESS].sort((a, b) => b.year - a.year);
  if (!ordered.length) {
    return `<main class="inc-main"><div class="container"><header class="inc-pagehead"><h1>Press</h1></header><p class="inc-prose">Selected press and writing on Incubator exhibitions will be collected here. For press enquiries, please reach out to <a href="mailto:fabian@strobellall.com">fabian@strobellall.com</a>.</p></div></main>`;
  }
  const years = ordered.map((y) => `<section class="inc-press-year"><h2>${esc(y.year)}</h2><div class="inc-press-list">${(y.items || []).map((it) => `<a href="${esc(it.href)}" class="inc-press-item"><span class="inc-press-item__date">${esc(it.date)}</span><span class="inc-press-item__pub">${esc(it.pub)}</span><span class="inc-press-item__title">${esc(it.title)}</span></a>`).join("")}</div></section>`).join("");
  return `<main class="inc-main"><div class="container"><header class="inc-pagehead"><h1>Press</h1></header>${years}</div></main>`;
}

function aboutBody() {
  const team = RABOUT.team.length
    ? `<section class="container inc-detail__bio">${RABOUT.team.map((m) => `<p><strong>${esc(m.name)}</strong> — ${esc(m.role || "")}</p>`).join("")}</section>`
    : "";
  return `<main class="inc-main"><article class="container inc-detail"><header class="inc-pagehead"><h1>About</h1></header><div class="inc-about__intro">${proseHtml(RABOUT.paragraphs)}<img class="inc-about__img" src="${esc(RABOUT.image)}" alt="Inside the Incubator gallery on Chiltern Street" loading="lazy"></div>${team}</article></main>`;
}

function contactBody() {
  const c = RCONTACT;
  const mapsSearch = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.mapQuery);
  const address = c.addressLines.map((l) => esc(l)).join("<br>");
  const hours = c.hours.map((l) => esc(l)).join("<br>");
  const internship = c.internshipText ? `<p>${esc(c.internshipText)}</p>` : "";
  return `<main class="inc-main"><div class="container inc-contact"><header class="inc-pagehead"><h1>Contact</h1></header><div class="inc-contact__grid"><section><h3>Visit</h3><p>${address}<br><a href="${esc(mapsSearch)}" target="_blank" rel="noopener">View on Google Maps</a></p><h3>Hours</h3><p>${hours}</p><h3>Enquiries</h3><p>For general enquiries, please reach out to:<br><a href="mailto:${esc(c.enquiriesEmail)}">${esc(c.enquiriesEmail)}</a></p><p>For press enquiries, please reach out to:<br><a href="mailto:${esc(c.pressEmail)}">${esc(c.pressEmail)}</a></p>${internship}<h3>Follow</h3><p><a href="${esc(c.instagramUrl)}" target="_blank" rel="noopener">${esc(c.instagramHandle)}</a></p><h3>Mailing list</h3><p><a class="inc-btn" href="${esc(c.mailingListUrl)}" target="_blank" rel="noopener">Subscribe</a></p></section><section><h3>Find us</h3><div class="inc-map__caption">${esc(c.mapCaption)}</div></section></div></div></main>`;
}

/* ====================================================================== */
/*  JSON-LD                                                               */
/* ====================================================================== */
const GALLERY_NODE = {
  "@type": ["ArtGallery", "LocalBusiness"],
  "@id": SITE_URL + "/#gallery",
  name: SITE_NAME,
  url: SITE_URL + "/",
  image: DEFAULT_OG,
  logo: SITE_URL + "/icon-512.png",
  email: RCONTACT.enquiriesEmail,
  description: "Incubator is a London gallery championing exceptional emerging artists, at 2 Chiltern Street, Marylebone.",
  address: {
    "@type": "PostalAddress",
    streetAddress: "2 Chiltern Street",
    addressLocality: "London",
    addressRegion: "Marylebone",
    postalCode: "W1U 7PR",
    addressCountry: "GB",
  },
  sameAs: [RCONTACT.instagramUrl],
  openingHoursSpecification: [
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Thursday", "Friday", "Saturday"], opens: "11:00", closes: "18:00" },
    { "@type": "OpeningHoursSpecification", dayOfWeek: ["Sunday"], opens: "11:00", closes: "17:00" },
  ],
};

const ldGallery = () => ({ "@context": "https://schema.org", ...GALLERY_NODE });
const ldWebsite = () => ({ "@context": "https://schema.org", "@type": "WebSite", "@id": SITE_URL + "/#website", name: SITE_NAME, url: SITE_URL + "/", publisher: { "@id": SITE_URL + "/#gallery" } });

function ldBreadcrumb(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: SITE_URL + it.path })),
  };
}

function ldExhibition(ex) {
  const node = {
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    name: showPlainTitle(ex),
    startDate: ex.startISO || undefined,
    endDate: ex.endISO || undefined,
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    url: SITE_URL + "/exhibitions/" + ex.id,
    image: ex.heroImage ? abs(ex.heroImage) : DEFAULT_OG,
    location: { "@type": "ArtGallery", name: SITE_NAME, address: GALLERY_NODE.address, url: SITE_URL + "/" },
    organizer: { "@type": "Organization", name: SITE_NAME, url: SITE_URL + "/" },
  };
  if ((ex.pressRelease || []).length) node.description = clip(ex.pressRelease.find((p) => plain(p).length > 60) || ex.pressRelease[0], 300);
  if (!ex.isGroup && ex.artist) node.performer = { "@type": "Person", name: ex.artist };
  if (ex.isGroup && (ex.groupArtists || []).length) node.performer = ex.groupArtists.map((n) => ({ "@type": "Person", name: n }));
  return node;
}

function ldArtist(artist) {
  const node = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: artist.name,
    url: SITE_URL + "/artists/" + artist.id,
    jobTitle: "Artist",
  };
  if ((artist.bio || []).length) node.description = clip(artist.bio[0], 300);
  return node;
}

/* ====================================================================== */
/*  HTML DOCUMENT TEMPLATE                                                */
/* ====================================================================== */
const REACT_SCRIPTS = `<script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" integrity="sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z" crossorigin="anonymous"></script>
    <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" integrity="sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1" crossorigin="anonymous"></script>
    <script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>`;

const APP_SCRIPTS = `<script type="text/babel" src="js/data.jsx"></script>
    <script type="text/babel" src="js/components.jsx"></script>
    <script type="text/babel" src="js/screens.jsx"></script>
    <script type="text/babel" src="js/report-issue.jsx"></script>
    <script type="text/babel" src="js/admin.jsx"></script>
    <script type="text/babel" src="js/app.jsx"></script>`;

function page({ path, title, description, ogImage, ogType = "website", jsonLd = [], body, noindex = false }) {
  const canonical = SITE_URL + path;
  const img = ogImage || DEFAULT_OG;
  const ld = jsonLd.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n    ");
  const robots = noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow,max-image-preview:large">';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <base href="/">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    ${robots}
    <link rel="canonical" href="${esc(canonical)}">

    <meta property="og:type" content="${ogType}">
    <meta property="og:site_name" content="${SITE_NAME}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${esc(canonical)}">
    <meta property="og:image" content="${esc(img)}">
    <meta property="og:locale" content="en_GB">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${esc(img)}">

    <meta name="theme-color" content="#009838">
    <link rel="icon" href="favicon.ico" sizes="any">
    <link rel="icon" href="favicon.svg" type="image/svg+xml">
    <link rel="apple-touch-icon" href="apple-touch-icon.png">
    <link rel="manifest" href="site.webmanifest">

    <link rel="stylesheet" href="css/ds.css">
    <link rel="stylesheet" href="css/site.css">
    <link rel="stylesheet" href="css/mockups.css">
    <link rel="stylesheet" href="css/app.css">

    ${ld}
  </head>
  <body>
    <div id="root">${body}</div>

    <script>
      window.REPORT_ISSUE_ENDPOINT = "https://incubator-report-issue.noahberrie7.workers.dev";
      window.REPORT_ISSUE_REPO = "no-ahb/incubator-site";
    </script>

    ${REACT_SCRIPTS}
    ${APP_SCRIPTS}
  </body>
</html>
`;
}

/* ====================================================================== */
/*  BUILD                                                                 */
/* ====================================================================== */
const OUT = [];
function emit(routePath, filePath, html) {
  const full = join(ROOT, filePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html);
  OUT.push(routePath);
}

// Home
emit("/", "index.html", page({
  path: "/",
  title: "Incubator — Emerging Art Gallery, Marylebone, London",
  description: "Incubator is a London gallery championing exceptional emerging artists at 2 Chiltern Street, Marylebone. See current and past exhibitions.",
  ogType: "website",
  jsonLd: [ldGallery(), ldWebsite()],
  body: homeBody(),
}));

// Exhibitions list
emit("/exhibitions", "exhibitions.html", page({
  path: "/exhibitions",
  title: "Exhibitions — Incubator",
  description: `Browse all ${ALL_SHOWS.length} exhibitions at Incubator, the emerging-art gallery on Chiltern Street, Marylebone, London — solo and group shows from 2021 to today.`,
  jsonLd: [ldBreadcrumb([{ name: "Home", path: "/" }, { name: "Exhibitions", path: "/exhibitions" }])],
  body: listBody(),
}));

// Exhibition detail pages
for (const ex of ALL_SHOWS) {
  const title = ex.isGroup ? `${ex.title} — Incubator` : `${[ex.artist, ex.title].filter(Boolean).join(": ")} — Incubator`;
  const lead = (ex.pressRelease || []).find((p) => plain(p).length > 60) || (ex.pressRelease || [])[0] || "";
  const description = clip(`${showPlainTitle(ex)}. ${ex.dates}. ${plain(lead)}`, 158);
  emit("/exhibitions/" + ex.id, `exhibitions/${ex.id}.html`, page({
    path: "/exhibitions/" + ex.id,
    title,
    description,
    ogType: "article",
    ogImage: ex.heroImage ? abs(ex.heroImage) : DEFAULT_OG,
    jsonLd: [
      ldExhibition(ex),
      ldBreadcrumb([{ name: "Home", path: "/" }, { name: "Exhibitions", path: "/exhibitions" }, { name: showPlainTitle(ex), path: "/exhibitions/" + ex.id }]),
    ],
    body: exhibitionBody(ex),
  }));
}

// Artist pages (only artists with at least one show, mirroring the SPA)
const artistPages = ARTISTS.filter((a) => artistShows(a).length > 0);
for (const artist of artistPages) {
  const shows = artistShows(artist);
  const hero = shows.find((e) => !e.isGroup) || shows[0];
  const description = clip(`${artist.name} at Incubator. ${(artist.bio || [])[0] || ""}`, 158);
  emit("/artists/" + artist.id, `artists/${artist.id}.html`, page({
    path: "/artists/" + artist.id,
    title: `${artist.name} — Incubator`,
    description,
    ogType: "article",
    ogImage: hero && hero.heroImage ? abs(hero.heroImage) : DEFAULT_OG,
    jsonLd: [
      ldArtist(artist),
      ldBreadcrumb([{ name: "Home", path: "/" }, { name: "Exhibitions", path: "/exhibitions" }, { name: artist.name, path: "/artists/" + artist.id }]),
    ],
    body: artistBody(artist),
  }));
}

// Press
emit("/press", "press.html", page({
  path: "/press",
  title: "Press — Incubator",
  description: "Selected press and writing on Incubator exhibitions. For press enquiries, contact fabian@strobellall.com.",
  jsonLd: [ldBreadcrumb([{ name: "Home", path: "/" }, { name: "Press", path: "/press" }])],
  body: pressBody(),
}));

// About
emit("/about", "about.html", page({
  path: "/about",
  title: "About — Incubator",
  description: "Incubator is a London gallery founded in 2021, championing exceptional emerging artists. A carbon-neutral member of the Gallery Climate Coalition.",
  jsonLd: [ldGallery(), ldBreadcrumb([{ name: "Home", path: "/" }, { name: "About", path: "/about" }])],
  body: aboutBody(),
}));

// Contact
emit("/contact", "contact.html", page({
  path: "/contact",
  title: "Visit & Contact — Incubator",
  description: "Visit Incubator at 2 Chiltern Street, Marylebone, London W1U 7PR. Open Thur–Sat 11–6, Sun 11–5. Nearest tube Baker Street.",
  jsonLd: [ldGallery(), ldBreadcrumb([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }])],
  body: contactBody(),
}));

// Admin — app shell, kept out of the index and search results.
emit("/admin", "admin.html", page({
  path: "/admin",
  title: "Admin — Incubator",
  description: "Incubator site administration.",
  noindex: true,
  jsonLd: [],
  body: `<main class="inc-main inc-datastate"><div class="container"><p>Loading…</p></div></main>`,
}));

/* ---------- sitemap.xml ---------------------------------------------------- */
const SITEMAP_ROUTES = OUT.filter((p) => p !== "/admin");
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SITEMAP_ROUTES.map((p) => `  <url><loc>${SITE_URL}${p === "/" ? "/" : p}</loc><lastmod>${TODAY}</lastmod></url>`).join("\n")}
</urlset>
`;
writeFileSync(join(ROOT, "sitemap.xml"), sitemap);

console.log(`Prerendered ${OUT.length} pages + sitemap.xml (${SITEMAP_ROUTES.length} urls).`);
