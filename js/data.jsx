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

// Full parsed payload INCLUDING hidden shows. Public arrays above are filtered;
// the admin screen reads this to manage everything.
let SITE_DATA = null;

const DATA_URL = "data/shows.json";

async function loadSiteData() {
  // no-store so an admin sees their edit immediately after the Pages redeploy.
  const res = await fetch(DATA_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load site data (${res.status})`);
  const data = await res.json();

  SITE_DATA = data;
  ARTISTS = Array.isArray(data.artists) ? data.artists : [];
  PRESS = Array.isArray(data.press) ? data.press : [];
  EXHIBITION_ARCHIVE = (Array.isArray(data.archive) ? data.archive : []).filter((e) => !e.hidden);
  EXHIBITIONS = (Array.isArray(data.exhibitions) ? data.exhibitions : []).filter((e) => !e.hidden);

  Object.assign(window, { EXHIBITIONS, ARTISTS, PRESS, EXHIBITION_ARCHIVE, SITE_DATA });
  return data;
}

Object.assign(window, {
  EXHIBITIONS,
  ARTISTS,
  PRESS,
  EXHIBITION_ARCHIVE,
  loadSiteData,
  getSiteData: () => SITE_DATA,
});
