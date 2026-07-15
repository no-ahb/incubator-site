// Incubator data loader — single source of truth is data/shows.json.
//
// Show + artist content used to be hardcoded here. It now lives in
// data/shows.json so the /admin page can add, edit, hide and unhide shows
// (via the Worker, which commits the file) without anyone editing code.
//
// EXHIBITIONS / ARTISTS / PRESS / EXHIBITION_ARCHIVE are `let` bindings in the
// shared classic-script scope, so the screens read them by name. loadSiteData()
// reassigns them once the JSON arrives, and the app re-renders.

let EXHIBITIONS = [];
let ARTISTS = [];
let PRESS = [];
let EXHIBITION_ARCHIVE = [];
// Singleton page content (About / Contact). Null until loaded; screens fall back
// to their built-in defaults so the site renders before these keys are populated.
let ABOUT = null;
let CONTACT = null;

// Full parsed payload INCLUDING hidden shows. Public arrays above are filtered;
// the admin screen reads this to manage everything.
let SITE_DATA = null;

const DATA_URL = "data/shows.json";

// Older Worker saves appended one group per article, repeating the year heading
// on the Press page (#110). Canonicalise at ingestion — one group per year,
// newest first — so every consumer sees merged data. Number() also merges a
// hand-edited "2023" string with a numeric 2023.
function mergePressYears(groups) {
  const byYear = new Map();
  groups.forEach((g) => {
    const year = Number(g && g.year) || 0;
    byYear.set(year, (byYear.get(year) || []).concat((g && g.items) || []));
  });
  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, items]) => ({ year, items }));
}

async function loadSiteData() {
  // no-cache (not no-store): always revalidates, so an admin still sees their
  // edit immediately after the Pages redeploy — but an unchanged file answers
  // with a 304 instead of re-downloading ~250 KB on every page load.
  const res = await fetch(DATA_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load site data (${res.status})`);
  const data = await res.json();

  SITE_DATA = data;
  ARTISTS = Array.isArray(data.artists) ? data.artists : [];
  PRESS = mergePressYears(Array.isArray(data.press) ? data.press : []);
  EXHIBITION_ARCHIVE = (Array.isArray(data.archive) ? data.archive : []).filter((e) => !e.hidden);
  EXHIBITIONS = (Array.isArray(data.exhibitions) ? data.exhibitions : []).filter((e) => !e.hidden);
  ABOUT = (data.about && typeof data.about === "object") ? data.about : null;
  CONTACT = (data.contact && typeof data.contact === "object") ? data.contact : null;

  Object.assign(window, { EXHIBITIONS, ARTISTS, PRESS, EXHIBITION_ARCHIVE, ABOUT, CONTACT, SITE_DATA });
  return data;
}

Object.assign(window, {
  EXHIBITIONS,
  ARTISTS,
  PRESS,
  EXHIBITION_ARCHIVE,
  ABOUT,
  CONTACT,
  loadSiteData,
  getSiteData: () => SITE_DATA,
});
