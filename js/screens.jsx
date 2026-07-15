// Incubator mockup — page-type screens.
// Each screen is the full body for one route, with header + footer outside.

const { useState: msState, useMemo: msMemo, useEffect: msEffect } = React;

// Eyebrow label for a show's status, decided purely by the real current date
// rather than the admin "current" flag (which goes stale once a later show
// opens — see #90). A show whose date range spans today is "Current"; one that
// hasn't opened yet is "Forthcoming"; anything else is past. heroFallback: on
// the home hero, a past fallback show reads as the "Most recent exhibition".
function exhibitionStatus(ex, { heroFallback = false } = {}) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const started = ex.startISO && ex.startISO <= todayISO;
  const ended = ex.endISO && ex.endISO < todayISO;
  if (started && !ended) return "Current exhibition";
  if (ex.startISO && ex.startISO > todayISO) return "Forthcoming";
  return heroFallback ? "Most recent exhibition" : "Past exhibition";
}

/* =====================================================================
   HOME
   ===================================================================== */
function HomeScreen({ onNav }) {
  const TODAY = new Date().toISOString().slice(0, 10);
  const all = [...EXHIBITIONS, ...EXHIBITION_ARCHIVE];
  // Pick the lead show purely by date: whatever is on view now (most recently
  // opened wins), else the most recently opened show overall. There's no admin
  // "current" pin anymore — dates decide, so a stale flag can never mislead (#90).
  const started = EXHIBITIONS
    .filter((e) => (e.startISO || "") <= TODAY)
    .sort((a, b) => (b.startISO || "").localeCompare(a.startISO || ""));
  const onView = started.filter((e) => !e.endISO || e.endISO >= TODAY);
  const current = onView[0] || started[0] || EXHIBITIONS[0];

  // No visible exhibitions (e.g. all hidden, or a brand-new gallery). Render a
  // calm placeholder rather than dereferencing an undefined `current`.
  if (!current) {
    return (
      <main className="inc-main">
        <section className="inc-section container">
          <header className="inc-section__head"><h2>Exhibitions</h2></header>
          <p className="inc-prose" style={{ color: "var(--ink-3)" }}>
            No exhibitions are on view at the moment. Please check back soon.
          </p>
        </section>
      </main>
    );
  }
  // Every genuinely upcoming show, soonest first — the season ahead is listed
  // in full with dates, not just the next opening (#125).
  const upcoming = EXHIBITIONS
    .filter((e) => e.id !== current.id && (e.startISO || "") > TODAY)
    .sort((a, b) => (a.startISO || "").localeCompare(b.startISO || ""));
  // Everything already opened except the lead show (upcoming = startISO > TODAY).
  const past = all
    .filter((e) => e.id !== current.id && (e.startISO || "") <= TODAY)
    .sort((a, b) => (b.startISO || "").localeCompare(a.startISO || ""))
    .slice(0, 8);

  return (
    <main className="inc-main">
      {/* Current — full bleed poster + meta */}
      <section className="inc-hero">
        <a
          className="inc-hero__media"
          href={"#/exhibitions/" + current.id}
          onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + current.id); }}
        >
          <Poster ex={current} size="hero" />
        </a>
        <div className="container inc-hero__meta">
          <span className="inc-eyebrow">{exhibitionStatus(current, { heroFallback: true })}</span>
          <h1 className="inc-hero__title">
            <a
              href={"#/exhibitions/" + current.id}
              onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + current.id); }}
            >
              {current.isGroup ? <em>{current.title}</em> : <>{current.artist}{current.title ? <>:&nbsp;<em>{current.title}</em></> : null}</>}
            </a>
          </h1>
          <div className="inc-meta">{current.dates}</div>
          <a
            className="inc-hero__cta"
            href={"#/exhibitions/" + current.id}
            onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + current.id); }}
          >
            Read more →
          </a>
        </div>
      </section>

      {/* Forthcoming — every upcoming show, soonest first, with dates (#125) */}
      {upcoming.length > 0 && (
      <section className="inc-section container">
        <header className="inc-section__head">
          <h2>Forthcoming</h2>
        </header>
        {upcoming.map((next) => (
        <div className="inc-coming" key={next.id}>
          <a
            href={"#/exhibitions/" + next.id}
            className="inc-card"
            onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + next.id); }}
          >
            <Poster ex={next} size="card" />
          </a>
          <div className="inc-coming__meta">
            {/* When the show has its own opening line, don't derive a second
                (contradicting) date from startISO — openings are usually the
                evening before the public dates. */}
            <span className="inc-eyebrow">
              {next.openingNote ? "Forthcoming" : <>Opening {parseInt(next.startISO.slice(8,10), 10)} {monthName(next.startISO)}</>}
            </span>
            <h3 className="inc-hero__title">
              {next.isGroup ? <em>{next.title}</em> : <>{next.artist}{next.title ? <>:&nbsp;<em>{next.title}</em></> : null}</>}
            </h3>
            <div className="inc-meta">{next.dates}</div>
            {next.openingNote ? <div className="inc-meta">{next.openingNote}</div> : null}
            <a
              className="inc-hero__cta"
              href={"#/exhibitions/" + next.id}
              onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + next.id); }}
            >
              Read more →
            </a>
          </div>
        </div>
        ))}
      </section>
      )}

      {/* Past */}
      <section className="inc-section container">
        <header className="inc-section__head">
          <h2>Past exhibitions</h2>
          <a href="#/exhibitions" onClick={(e)=>{e.preventDefault(); onNav("/exhibitions");}}>View all</a>
        </header>
        <div className="inc-past">
          {past.map((ex) => (
            <ExhibitionCard key={ex.id} ex={ex} onNav={onNav} />
          ))}
        </div>
      </section>
    </main>
  );
}

function monthName(iso) {
  const m = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return m[parseInt(iso.slice(5,7), 10) - 1];
}

/* =====================================================================
   EXHIBITIONS LIST — adopts the Artists-list layout
   ===================================================================== */
function ExhibitionsListScreen({ onNav }) {
  const all = msMemo(() => [...EXHIBITIONS, ...EXHIBITION_ARCHIVE], []);
  const [sort, setSort]   = msState("date");
  const [filter, setFilter] = msState("all"); // all | solo | group
  const [query, setQuery] = msState("");
  const sorted = msMemo(() => {
    let xs = all.slice();
    if (filter === "solo")  xs = xs.filter((e) => !e.isGroup);
    if (filter === "group") xs = xs.filter((e) =>  e.isGroup);
    const q = query.trim().toLowerCase();
    if (q) {
      xs = xs.filter((e) =>
        (e.artist || "").toLowerCase().includes(q) ||
        (e.title || "").toLowerCase().includes(q) ||
        // Group-show participants are listed only in the show's cast, and many
        // have no artist page of their own — match them so a search still
        // surfaces the group show they're in (#96).
        (e.groupArtists || []).some((n) => n.toLowerCase().includes(q))
      );
    }
    xs.sort((a, b) =>
      sort === "date"
        ? (b.startISO || "").localeCompare(a.startISO || "")
        : (a.artist || a.title).localeCompare(b.artist || b.title)
    );
    return xs;
  }, [all, sort, filter, query]);

  const [hovered, setHovered] = msState(sorted[0]);
  // keep hovered in sync if filter empties the list
  const preview = hovered && sorted.find((e) => e.id === hovered.id) ? hovered : sorted[0];

  // Warm the browser cache for the hover preview posters during idle time so the
  // image is already loaded on first hover instead of fetching on demand (#95).
  // Skipped on data-saver / slow connections to avoid a heavy background load.
  // Capped to the first rows on screen: warming every hero pulled ~35 MB per
  // visit; the list is date-sorted, so the top posters are the likely hovers.
  msEffect(() => {
    const conn = navigator.connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""))) return;
    const urls = sorted.slice(0, 8).map((e) => e.heroImage).filter(Boolean);
    const warm = () => urls.forEach((src) => { const img = new Image(); img.src = src; });
    const ric = window.requestIdleCallback;
    if (ric) { const h = ric(warm); return () => window.cancelIdleCallback && window.cancelIdleCallback(h); }
    const t = setTimeout(warm, 200);
    return () => clearTimeout(t);
  }, [all]);

  return (
    <main className="inc-main">
      <div className="container">
        <header className="inc-pagehead">
          <h1>Exhibitions</h1>
        </header>

        <div className="inc-listsearch">
          <input
            type="search"
            className="inc-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by artist or exhibition…"
            aria-label="Search exhibitions"
          />
        </div>

        <div className="inc-listbar">
          <div className="inc-toggle" role="tablist" aria-label="Filter">
            {[
              ["all",   "All"],
              ["solo",  "Solo"],
              ["group", "Group"],
            ].map(([k, l]) => (
              <button
                key={k}
                role="tab"
                aria-selected={filter === k}
                className={filter === k ? "is-active" : ""}
                onClick={() => setFilter(k)}
              >
                {l}
              </button>
            ))}
          </div>
          <span className="inc-eyebrow inc-listbar__count">{sorted.length} exhibition{sorted.length === 1 ? "" : "s"}</span>
          <div className="inc-toggle" role="tablist" aria-label="Sort">
            <button role="tab" aria-selected={sort==="date"}  className={sort==="date"  ? "is-active":""} onClick={()=>setSort("date")}>By date</button>
            <button role="tab" aria-selected={sort==="alpha"} className={sort==="alpha" ? "is-active":""} onClick={()=>setSort("alpha")}>A – Z</button>
          </div>
        </div>

        {sorted.length === 0 && (
          <p className="inc-prose" style={{ color: "var(--ink-3)", marginTop: "var(--s-8)" }}>
            No exhibitions match “{query}”.
          </p>
        )}

        <div className="inc-list">
          <div className="inc-list__col">
            <ul className="inc-list__items">
              {sorted.map((ex) => (
                <ExhibitionsListRow
                  key={ex.id}
                  ex={ex}
                  onNav={onNav}
                  onHover={setHovered}
                />
              ))}
            </ul>
          </div>
          <aside className="inc-list__preview" aria-hidden="true">
            {preview ? (
              // The poster mirrors the list's hovered/first item. It duplicates a
              // list row, so it stays out of the a11y tree and tab order (the rows
              // are the canonical links) — but pointer/touch taps navigate, which
              // is what mobile users reach for since the poster sits above the list.
              <a
                className="inc-list__preview-link"
                href={"#/exhibitions/" + preview.id}
                tabIndex={-1}
                onClick={(e) => { e.preventDefault(); onNav && onNav("/exhibitions/" + preview.id); }}
              >
                <Poster ex={preview} size="card" />
                <div className="inc-list__preview-meta">
                  {/* Title sits on its own line under the artist — inline it
                      wrapped awkwardly on long titles (#114). */}
                  <span className="inc-list__preview-main">
                    {preview.isGroup
                      ? (preview.title ? <em>{preview.title}</em> : null)
                      : <>
                          <span>{preview.artist}</span>
                          {preview.title ? <em>{preview.title}</em> : null}
                        </>
                    }
                  </span>
                  <span className="inc-list__preview-dates">{preview.dates}</span>
                </div>
              </a>
            ) : null}
          </aside>
        </div>
      </div>
    </main>
  );
}

/* =====================================================================
   EXHIBITION DETAIL — solo and group variants share this component
   ===================================================================== */
function ExhibitionDetailScreen({ id, onNav }) {
  const all = [...EXHIBITIONS, ...EXHIBITION_ARCHIVE];
  const ex = all.find((e) => e.id === id);
  // A stale or mistyped URL gets an honest not-found, not an arbitrary show
  // presented as if it were the page asked for.
  if (!ex) {
    return (
      <main className="inc-main">
        <div className="container" style={{ padding: "80px 0" }}>
          <p className="inc-prose" style={{ color: "var(--ink-3)" }}>Exhibition not found.</p>
          <p className="inc-back" style={{ marginTop: "var(--s-6)" }}>
            <a href="#/exhibitions" onClick={(e)=>{e.preventDefault(); onNav("/exhibitions");}}>← Back to exhibitions</a>
          </p>
        </div>
      </main>
    );
  }
  const artistRec = !ex.isGroup ? ARTISTS.find((a) => a.id === ex.artistId) : null;
  // "Other exhibitions by …" includes both the artist's own solo shows and any
  // group shows they were featured in. Solo shows key off artistId; group shows
  // list participants as free-text names, so match those by slug or by this
  // artist's name — mirroring ArtistScreen's resolver (#96).
  const exArtistName = (!ex.isGroup && ex.artist) ? ex.artist.trim().toLowerCase() : "";
  const otherShows = (!ex.isGroup && ex.artistId)
    ? all
        .filter((e) => e.id !== ex.id && (
          e.artistId === ex.artistId ||
          (e.isGroup && (e.groupArtists || []).some((n) =>
            slug(n) === ex.artistId || (exArtistName && n.trim().toLowerCase() === exArtistName)))
        ))
        .sort((a, b) => (b.startISO || "").localeCompare(a.startISO || ""))
    : [];
  const artistLink = (label) => (
    <a
      href={"#/artists/" + ex.artistId}
      onClick={(e) => { e.preventDefault(); onNav("/artists/" + ex.artistId); }}
    >
      {label}
    </a>
  );
  return (
    <main className="inc-main">
      <article className="inc-detail">
        <HeroPoster ex={ex} size="hero" />

        <div className="container inc-detail__head">
          <span className="inc-eyebrow">
            {exhibitionStatus(ex)}
            {ex.isGroup ? " · Group show" : ""}
          </span>
          <h1>
            {ex.isGroup
              ? <em>{ex.title}</em>
              : <>{artistRec ? artistLink(ex.artist) : ex.artist}{ex.title ? <>: <em>{ex.title}</em></> : null}</>}
          </h1>
          <div className="inc-meta">{ex.dates}</div>
          {/* The opening line matters until the show opens; afterwards it would
              read as stale ("Opening on the evening of 9 September" on a past
              show), and no admin field exists to clear it. */}
          {ex.openingNote && ex.startISO && ex.startISO > new Date().toISOString().slice(0, 10)
            ? <div className="inc-meta">{ex.openingNote}</div> : null}
          {ex.isGroup && (ex.groupArtists || []).length > 0 && (
            <div className="inc-participants">
              <span className="inc-participants__label">Artists</span>
              <span className="inc-participants__names">
                {sortByLastName(ex.groupArtists).map((n, i) => {
                  const aid = participantArtistId(n);
                  return (
                    <React.Fragment key={i}>
                      {i > 0 ? ", " : ""}
                      {aid ? (
                        <a
                          href={"#/artists/" + aid}
                          onClick={(e) => { e.preventDefault(); onNav("/artists/" + aid); }}
                        >{n}</a>
                      ) : n}
                    </React.Fragment>
                  );
                })}
              </span>
            </div>
          )}
        </div>

        {/* Forthcoming shows have no photography or release yet — hide the
            empty sections rather than showing bare headings (#125). */}
        {(ex.installation || []).length > 0 && (
          <section id="installation" className="container inc-detail__installation">
            <h3>Installation views</h3>
            <InstallationStrip frames={ex.installation} />
          </section>
        )}

        {hasRichContent(ex.pressRelease) && (
          <section id="release" className="container inc-detail__release">
            <h3>Press release</h3>
            <PressRelease paragraphs={ex.pressRelease} />
          </section>
        )}

        {/* Coverage of this show specifically — kept off the site-wide Press
            page on purpose (#115–#124). */}
        {(ex.press || []).length > 0 && (
          <section className="container inc-detail__press">
            <h3>Press</h3>
            <div className="inc-press-list">
              {ex.press.map((it, i) => <PressItem key={i} item={it} />)}
            </div>
          </section>
        )}

        {!ex.isGroup && ex.artist && (
          <p className="container inc-detail__enquire">
            <EnquireButton name={ex.artist} />
          </p>
        )}

        {otherShows.length > 0 && (
          <section className="container inc-related">
            <h3>{"Other exhibitions featuring " + ex.artist + " at Incubator"}</h3>
            <div className="inc-related__items">
              {otherShows.map((o) => (
                <div key={o.id} className="inc-related__row">
                  <a
                    className="inc-related__link"
                    href={"#/exhibitions/" + o.id}
                    onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + o.id); }}
                  >
                    <span className="inc-related__title">
                      {o.title ? <em>{o.title}</em> : (o.artist || "Untitled")}
                      {o.isGroup ? <span className="inc-related__tag"> — Group show</span> : null}
                    </span>
                    <span className="inc-related__dates">{o.dates}</span>
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        <p className="container inc-back">
          <a href="#/exhibitions" onClick={(e)=>{e.preventDefault(); onNav("/exhibitions");}}>← Back to exhibitions</a>
        </p>
      </article>
    </main>
  );
}

// A press release is "real" when it has visible text. A cleared rich-text
// editor saves markup like "<p><br></p>" — non-empty as a string, blank on
// screen — which must not resurrect a bare "Press release" heading.
function hasRichContent(v) {
  if (Array.isArray(v)) return v.some((p) => String(p).trim());
  return String(v || "").replace(/<[^>]*>|&nbsp;/gi, "").trim().length > 0;
}

function slug(name) {
  return name.toLowerCase()
    .replace(/[\u201C\u201D"'']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Resolve a group participant's free-text name to their artist-page id, or null
// when they have no page (external/one-off contributors have no artist record).
// Matches by slug or by the artist record's real name \u2014 mirrors ArtistScreen.
function participantArtistId(name) {
  const s = slug(name);
  const nm = name.trim().toLowerCase();
  const rec = ARTISTS.find((a) => a.id === s || (a.name || "").trim().toLowerCase() === nm);
  return rec ? rec.id : null;
}

/* =====================================================================
   ARTIST DETAIL — restructured per brief
   per-show block:  installation views   (no press release here)
   then once at the bottom:  biography  +  "more info" link
   ===================================================================== */
function ArtistScreen({ id, onNav }) {
  const artist = ARTISTS.find((a) => a.id === id);
  // Solo shows key off artistId; group shows list participants by free-text name.
  // Match those by slug, and by the artist's own record name, so a group show
  // appears on each featured artist's page even when the stored id was slugged
  // differently from the name (e.g. accents or a legacy import typo).
  const artistName = artist ? artist.name.trim().toLowerCase() : "";
  const shows = EXHIBITIONS
    .filter((e) => e.artistId === id || (e.isGroup && (e.groupArtists || []).some((n) => slug(n) === id || (artistName && n.trim().toLowerCase() === artistName))))
    .sort((a, b) => (b.startISO || "").localeCompare(a.startISO || ""));
  if (!artist || shows.length === 0) {
    return <div className="container" style={{padding:"80px 0"}}>Not found.</div>;
  }
  // Header image comes from the artist's own (most recent) solo show, not from a
  // group show they merely appeared in — those images aren't theirs (#97).
  const heroShow = shows.find((e) => !e.isGroup) || shows[0];
  return (
    <main className="inc-main">
      <article className="inc-detail">
        <Poster ex={heroShow} size="hero" />
        <div className="container inc-detail__head">
          <span className="inc-eyebrow">Artist</span>
          <h1>{artist.name}</h1>
        </div>

        {shows.map((ex, idx) => (
          <div key={ex.id} id={"show-" + idx} className={"inc-detail__show " + (idx > 0 ? "is-sub" : "")}>
            <header className="container inc-detail__show-head">
              {ex.title ? <h2><em>{ex.title}</em></h2> : null}
              <div className="inc-detail__show-meta">
                {ex.isGroup ? "Group show" : "Solo show"} · {ex.dates} ·{" "}
                <a href={"#/exhibitions/" + ex.id} onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + ex.id); }}>View exhibition →</a>
              </div>
            </header>

            {/* Same guard as the exhibition page — no bare heading over an
                empty strip for a show without photography yet (#125). */}
            {(ex.installation || []).length > 0 && (
              <section className="container inc-detail__installation">
                <h3>Installation views</h3>
                <InstallationStrip frames={ex.installation} />
              </section>
            )}
          </div>
        ))}

        <section id="biography" className="container inc-detail__bio">
          <h3>Biography</h3>
          <Prose paragraphs={artist.bio} />
        </section>

        <p className="container inc-detail__enquire">
          <EnquireButton name={artist.name} />
        </p>

        <p className="container inc-back">
          <a href="#/exhibitions" onClick={(e)=>{e.preventDefault(); onNav("/exhibitions");}}>← Back to exhibitions</a>
        </p>
      </article>
    </main>
  );
}

/* =====================================================================
   PRESS — chronological, 2026 first
   ===================================================================== */
function PressScreen() {
  // PRESS arrives canonical from data.jsx (one merged group per year, #110).
  const ordered = [...PRESS].sort((a, b) => b.year - a.year);
  return (
    <main className="inc-main">
      <div className="container">
        <header className="inc-pagehead">
          <h1>Press</h1>
        </header>
        {ordered.length === 0 ? (
          <p className="inc-prose" style={{ color: "var(--ink-3)", maxWidth: "62ch" }}>
            Selected press and writing on Incubator exhibitions will be collected here.
            For press enquiries, please reach out to:{" "}
            <a href="mailto:fabian@strobellall.com">fabian@strobellall.com</a>.
          </p>
        ) : ordered.map((year) => (
          <section key={year.year} className="inc-press-year">
            <h2>{year.year}</h2>
            <div className="inc-press-list">
              {year.items.map((it, i) => <PressItem key={i} item={it} />)}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

/* =====================================================================
   ABOUT — content is admin-editable (data.about); these are the fallbacks
   used until the keys are populated, or if the data fails to load.
   ===================================================================== */
const DEFAULT_ABOUT = {
  paragraphs: [
    "Incubator is a London-based gallery dedicated to championing exceptional emerging artists. Since its founding in 2021, the gallery has established itself as a platform for ambitious, innovative voices in contemporary art.",
    "Incubator presented the work of 42 artists in its first three years, earning a reputation for identifying and championing compelling new voices. Today, the gallery continues to provide a platform for emerging artists to engage new audiences and advance their artistic practices.",
    "As a carbon-neutral organisation and member of the Gallery Climate Coalition, Incubator is committed to embedding sustainability across its operations. The gallery continually reviews its practices to minimise environmental impact and contribute to a more sustainable future for the arts."
  ],
  image: "assets/about-image.jpg",
  team: [
    { name: "Angelica Jopling", role: "Founding Director" },
    { name: "Isabella Mackintosh", role: "Gallery Manager" },
  ],
};
function AboutScreen() {
  const about = (typeof ABOUT !== "undefined" && ABOUT) || DEFAULT_ABOUT;
  const paragraphs = (Array.isArray(about.paragraphs) && about.paragraphs.length) ? about.paragraphs : DEFAULT_ABOUT.paragraphs;
  const image = about.image || DEFAULT_ABOUT.image;
  const team = (Array.isArray(about.team) ? about.team : []).filter((m) => m && m.name);
  return (
    <main className="inc-main">
      <article className="container inc-detail">
        <header className="inc-pagehead">
          <h1>About</h1>
        </header>
        <div className="inc-about__intro">
          <Prose paragraphs={paragraphs} />
          <img className="inc-about__img" src={image} alt="Inside the Incubator gallery on Chiltern Street" loading="lazy" />
        </div>

        {team.length > 0 && (
          <section className="inc-about__team">
            {/* Each member is one flowing line — the old aligned-columns grid
                stretched the dash away from short names (#113). */}
            {team.map((m, i) => (
              <p key={i}>
                {m.name}
                <span className="inc-about__team-role"> — {m.role}</span>
              </p>
            ))}
          </section>
        )}
      </article>
    </main>
  );
}

/* =====================================================================
   CONTACT — content is admin-editable (data.contact); DEFAULT_CONTACT is the
   fallback used until the keys are populated, or if the data fails to load.
   Also feeds the footer + mobile menu via resolveContact() (components.jsx).
   ===================================================================== */
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
// Merge stored contact data over the defaults so a missing single field still
// renders. Shared by the Contact page, footer and mobile menu.
function resolveContact() {
  const c = (typeof CONTACT !== "undefined" && CONTACT) || {};
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
// Render a plain string with any email addresses turned into mailto links, so
// emails embedded in free-text (e.g. the internship blurb) are clickable.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
function linkifyEmails(text) {
  const str = String(text || "");
  const out = [];
  let last = 0;
  let m;
  EMAIL_RE.lastIndex = 0;
  while ((m = EMAIL_RE.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index));
    out.push(<a key={m.index} href={"mailto:" + m[0]}>{m[0]}</a>);
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}
function ContactScreen() {
  const c = resolveContact();
  const enc = encodeURIComponent(c.mapQuery);
  const mapsSearch = "https://www.google.com/maps/search/?api=1&query=" + enc;
  const mapsEmbed = "https://maps.google.com/maps?q=" + enc + "&z=16&output=embed";
  // Open the mailing-list form in a popup; fall back to the plain target=_blank
  // link if the browser blocks the popup.
  const openSubscribe = (e) => {
    const w = window.open(c.mailingListUrl, "incubator-subscribe", "width=540,height=720");
    if (w) e.preventDefault();
  };
  return (
    <main className="inc-main">
      <div className="container inc-contact">
        <header className="inc-pagehead"><h1>Contact</h1></header>

        <div className="inc-contact__grid">
          <section>
            <h3>Visit</h3>
            <p>
              {c.addressLines.map((line, i) => <React.Fragment key={i}>{line}<br/></React.Fragment>)}
              <a href={mapsSearch} target="_blank" rel="noopener">View on Google Maps</a>
            </p>

            <h3>Hours</h3>
            <p>
              {c.hours.map((line, i) => (
                <React.Fragment key={i}>{line}{i < c.hours.length - 1 ? <br/> : null}</React.Fragment>
              ))}
            </p>

            <h3>Enquiries</h3>
            <p>
              For general enquiries, please reach out to:<br/>
              <a href={"mailto:" + c.enquiriesEmail}>{c.enquiriesEmail}</a>
            </p>
            <p>
              For press enquiries, please reach out to:<br/>
              <a href={"mailto:" + c.pressEmail}>{c.pressEmail}</a>
            </p>
            {c.internshipText ? <p>{linkifyEmails(c.internshipText)}</p> : null}

            <h3>Follow</h3>
            <p>
              <a href={c.instagramUrl} target="_blank" rel="noopener">{c.instagramHandle}</a>
            </p>

            <h3>Mailing list</h3>
            <p>
              {/* A plain link, like every other link in this column — the green
                  centred button read as out of place here (#112). */}
              <a href={c.mailingListUrl} target="_blank" rel="noopener" onClick={openSubscribe}>
                Subscribe
              </a>
            </p>
          </section>

          <section>
            <h3>Find us</h3>
            <iframe
              className="inc-map"
              src={mapsEmbed}
              title="Map showing Incubator"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            {c.mapCaption ? <div className="inc-map__caption">{c.mapCaption}</div> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

Object.assign(window, {
  HomeScreen,
  ExhibitionsListScreen,
  ExhibitionDetailScreen,
  ArtistScreen,
  PressScreen,
  AboutScreen,
  ContactScreen,
  slug,
});
