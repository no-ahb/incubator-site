// Shared by the browser and static page builder.
const SITE_ORIGIN = "https://www.incubatorart.com";
function cleanRoute(path) { return "/" + String(path || "").split(/[?#]/)[0].split("/").filter(Boolean).join("/"); }
function pagePath(path) { const p = cleanRoute(path); return p === "/" ? p : p + "/"; }
function assetUrl(src) { return !src || /^(?:[a-z]+:|\/)/i.test(src) ? src : "/" + src; }
function imageProps(src, sizes = "(max-width: 600px) 100vw, 50vw") {
  const variants = (window.__IMAGE_MANIFEST__ || {})[src];
  return { src: assetUrl(src), ...(variants ? { srcSet: variants.map(v => v.url + " " + v.width + "w").join(", "), sizes } : {}) };
}
function navClick(e, onNav, path) {
  if (!onNav || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault(); onNav(path);
}
function artistShows(artist, data) {
  const nameSlug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return [...(data.exhibitions || []), ...(data.archive || [])].filter(e => !e.hidden &&
    (e.artistId === artist.id || (e.isGroup && (e.groupArtists || []).some(n =>
      nameSlug(n) === artist.id || n.trim().toLowerCase() === artist.name.trim().toLowerCase()))));
}
function publicArtists(data) { return (data.artists || []).filter(a => artistShows(a, data).length); }
function publicRoutes(data) {
  return ["/", "/exhibitions", "/artists", "/press", "/about", "/contact",
    ...[...(data.exhibitions || []), ...(data.archive || [])].filter(e => !e.hidden).map(e => "/exhibitions/" + e.id),
    ...publicArtists(data).map(a => "/artists/" + a.id)];
}
function pageMetadata(route, data) {
  route = cleanRoute(route);
  const seg = route.split("/").filter(Boolean);
  const all = [...(data.exhibitions || []), ...(data.archive || [])].filter(e => !e.hidden);
  const ex = seg[0] === "exhibitions" && all.find(e => e.id === seg[1]);
  const artist = seg[0] === "artists" && publicArtists(data).find(a => a.id === seg[1]);
  const found = route === "/admin" || publicRoutes(data).includes(route);
  const name = ex ? (ex.isGroup ? ex.title : [ex.artist, ex.title].filter(Boolean).join(": ")) : artist ? artist.name :
    ({exhibitions:"Exhibitions", artists:"Artists", press:"Press", about:"About", contact:"Contact", admin:"Admin"}[seg[0]] || "");
  const title = !found ? "Page not found — Incubator" : name ? name + " — Incubator" : "Incubator — Chiltern Street, London";
  const description = ex ? `${name} at Incubator, London. ${ex.dates || ""}`.trim() : artist ? `${artist.name} at Incubator, London. Exhibitions, biography and press.` :
    ({exhibitions:"Explore current, forthcoming and past exhibitions at Incubator, London. Browse by artist, exhibition and year.", artists:"Browse the A–Z directory of artists who have exhibited at Incubator, London.", press:"Press coverage of Incubator and its artists and exhibitions.", contact:"Visit Incubator at 2 Chiltern Street, Marylebone, London. Opening hours, directions and enquiries."}[seg[0]] || "Incubator is an exhibition programme for exceptional emerging artists working in London. 2 Chiltern Street, Marylebone.");
  const hero = artist && artistShows(artist, data).sort((a,b) => (b.startISO || "").localeCompare(a.startISO || ""));
  const image = (ex && ex.heroImage) || (hero && ((hero.find(e => !e.isGroup) || hero[0]).heroImage)) || (data.about || {}).image || "assets/about-image.jpg";
  const url = SITE_ORIGIN + pagePath(route);
  const gallery = {"@type":"ArtGallery", "@id":SITE_ORIGIN + "/#gallery", name:"Incubator", url:SITE_ORIGIN + "/", address:{"@type":"PostalAddress", streetAddress:(data.contact?.addressLines || ["2 Chiltern Street"])[0], addressLocality:"London", postalCode:"W1U 7PR", addressCountry:"GB"}};
  const graph = [gallery];
  if (ex) graph.push({"@type":"ExhibitionEvent", "@id":url + "#exhibition", name, url, description, image:new URL(assetUrl(image), SITE_ORIGIN).href, location:{"@id":gallery["@id"]}, organizer:{"@id":gallery["@id"]}, ...(ex.startISO ? {startDate:ex.startISO} : {}), ...(ex.endISO ? {endDate:ex.endISO} : {})});
  if (artist) graph.push({"@type":"Person", "@id":url + "#artist", name:artist.name, url});
  return {title, description, url, image:new URL(assetUrl(image), SITE_ORIGIN).href, noindex:!found || route === "/admin", jsonld:{"@context":"https://schema.org", "@graph":graph}};
}
if (typeof module !== "undefined") module.exports = { cleanRoute, pagePath, assetUrl, artistShows, publicArtists, publicRoutes, pageMetadata };
