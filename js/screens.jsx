// Incubator mockup — page-type screens.
// Each screen is the full body for one route, with header + footer outside.

const { useState: msState, useMemo: msMemo } = React;

/* =====================================================================
   HOME
   ===================================================================== */
function HomeScreen({ onNav }) {
  const TODAY = "2026-05-28";
  const all = [...EXHIBITIONS, ...EXHIBITION_ARCHIVE];
  const current = EXHIBITIONS.find((e) => e.current) || EXHIBITIONS[0];

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
  const next = EXHIBITIONS
    .filter((e) => !e.current && e.startISO > TODAY)
    .sort((a, b) => (a.startISO || "").localeCompare(b.startISO || ""))[0];
  const past = all
    .filter((e) => !e.current && (!next || e.id !== next.id))
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
          <span className="inc-eyebrow">Current exhibition</span>
          <h1 className="inc-hero__title">
            <a
              href={"#/exhibitions/" + current.id}
              onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + current.id); }}
            >
              {current.artist}{current.title ? <>:&nbsp;<em>{current.title}</em></> : null}
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

      {/* Forthcoming — only when a genuinely upcoming show exists */}
      {next && (
      <section className="inc-section container">
        <header className="inc-section__head">
          <h2>Forthcoming</h2>
        </header>
        <div className="inc-coming">
          <a
            href={"#/exhibitions/" + next.id}
            className="inc-card"
            onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + next.id); }}
          >
            <Poster ex={next} size="card" />
          </a>
          <div className="inc-coming__meta">
            <span className="inc-eyebrow">Opening {next.startISO.slice(8,10)} {monthName(next.startISO)}</span>
            <h3 className="inc-hero__title">
              {next.isGroup ? <em>{next.title}</em> : <>{next.artist}{next.title ? <>:&nbsp;<em>{next.title}</em></> : null}</>}
            </h3>
            <div className="inc-meta">{next.dates}</div>
            <a
              className="inc-hero__cta"
              href={"#/exhibitions/" + next.id}
              onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + next.id); }}
            >
              Read more →
            </a>
          </div>
        </div>
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
        (e.title || "").toLowerCase().includes(q)
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
              ["group", "Group shows"],
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
          <span className="inc-listbar__count">{sorted.length} exhibition{sorted.length === 1 ? "" : "s"}</span>
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
              <>
                <Poster ex={preview} size="card" />
                <div className="inc-list__preview-meta">
                  <span>
                    {preview.isGroup
                      ? (preview.title ? <em>{preview.title}</em> : null)
                      : <>{preview.artist}{preview.title ? <> · <em>{preview.title}</em></> : null}</>
                    }
                  </span>
                  <span>{preview.dates}</span>
                </div>
              </>
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
  const ex = all.find((e) => e.id === id) || EXHIBITIONS[0];
  const artistRec = !ex.isGroup ? ARTISTS.find((a) => a.id === ex.artistId) : null;
  const otherShows = (!ex.isGroup && ex.artistId)
    ? all
        .filter((e) => e.artistId === ex.artistId && e.id !== ex.id)
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
        <Poster ex={ex} size="hero" />

        <div className="container inc-detail__head">
          <span className="inc-eyebrow">
            {ex.current ? "Current exhibition" : "Past exhibition"}
            {ex.isGroup ? " · Group show" : ""}
          </span>
          <h1>
            {ex.isGroup
              ? <em>{ex.title}</em>
              : <>{artistRec ? artistLink(ex.artist) : ex.artist}{ex.title ? <>: <em>{ex.title}</em></> : null}</>}
          </h1>
          <div className="inc-meta">{ex.dates}</div>
        </div>

        <section id="installation" className="container inc-detail__installation">
          <h3>Installation views</h3>
          <InstallationStrip frames={ex.installation || ["a","b","c","d","e","f"]} />
        </section>

        <section id="release" className="container inc-detail__release">
          <h3>Press release</h3>
          <Prose paragraphs={ex.pressRelease || []} />
        </section>

        {otherShows.length > 0 && (
          <section className="container inc-related">
            <h3>{"Other exhibitions by " + ex.artist + " at Incubator"}</h3>
            <div className="inc-related__items">
              {otherShows.map((o) => (
                <div key={o.id} className="inc-related__row">
                  <a
                    className="inc-related__link"
                    href={"#/exhibitions/" + o.id}
                    onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + o.id); }}
                  >
                    <span className="inc-related__title">{o.title ? <em>{o.title}</em> : null}</span>
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

function slug(name) {
  return name.toLowerCase()
    .replace(/[\u201C\u201D"'']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* =====================================================================
   ARTIST DETAIL — restructured per brief
   per-show block:  installation views   (no press release here)
   then once at the bottom:  biography  +  "more info" link
   ===================================================================== */
function ArtistScreen({ id, onNav }) {
  const artist = ARTISTS.find((a) => a.id === id);
  const shows = EXHIBITIONS
    .filter((e) => e.artistId === id)
    .sort((a, b) => b.startISO.localeCompare(a.startISO));
  if (!artist || shows.length === 0) {
    return <div className="container" style={{padding:"80px 0"}}>Not found.</div>;
  }
  return (
    <main className="inc-main">
      <article className="inc-detail">
        <Poster ex={shows[0]} size="hero" />
        <div className="container inc-detail__head">
          <span className="inc-eyebrow">Artist</span>
          <h1>{artist.name}</h1>
        </div>

        {shows.map((ex, idx) => (
          <div key={ex.id} id={"show-" + idx} className={"inc-detail__show " + (idx > 0 ? "is-sub" : "")}>
            <header className="container inc-detail__show-head">
              {ex.title ? <h2><em>{ex.title}</em></h2> : null}
              <div className="inc-detail__show-meta">{ex.dates}</div>
            </header>

            <section className="container inc-detail__installation">
              <h3>Installation views</h3>
              <InstallationStrip frames={ex.installation} />
            </section>
          </div>
        ))}

        <section id="biography" className="container inc-detail__bio">
          <h3>Biography</h3>
          <Prose paragraphs={artist.bio} />
        </section>

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
   ABOUT
   ===================================================================== */
function AboutScreen() {
  return (
    <main className="inc-main">
      <article className="container inc-detail">
        <header className="inc-pagehead">
          <h1>About</h1>
        </header>
        <div className="inc-about__intro">
          <Prose
            paragraphs={[
              "Incubator is a London-based gallery dedicated to championing exceptional emerging artists. Since its founding in 2021, the gallery has established itself as a platform for ambitious, innovative voices in contemporary art.",
              "Incubator presented the work of 42 artists in its first three years, earning a reputation for identifying and championing compelling new voices. Today, the gallery continues to provide a platform for emerging artists to engage new audiences and advance their artistic practices.",
              "As a carbon-neutral organisation and member of the Gallery Climate Coalition, Incubator is committed to embedding sustainability across its operations. The gallery continually reviews its practices to minimise environmental impact and contribute to a more sustainable future for the arts."
            ]}
          />
          <img className="inc-about__img" src="assets/about-image.jpg" alt="Inside the Incubator gallery on Chiltern Street" loading="lazy" />
        </div>

        <section className="container inc-detail__bio" style={{ paddingInline: 0, marginTop: "var(--s-16)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--s-3) var(--s-10)", fontSize: 16, maxWidth: 720 }}>
            <span><strong>Angelica Jopling</strong></span><span>Founding Director</span>
            <span><strong>Isabella Mackintosh</strong></span><span>Gallery Manager</span>
          </div>
        </section>
      </article>
    </main>
  );
}

/* =====================================================================
   CONTACT  (new page)
   ===================================================================== */
const SUBSCRIBE_URL  = "https://first-thursday.typeform.com/incubator";
const MAPS_EMBED_URL = "https://maps.google.com/maps?q=2+Chiltern+Street+London+W1U+7PR&z=16&output=embed";
// Open the First Thursday subscription form in a popup; fall back to the plain
// target="_blank" link if the browser blocks the popup.
function openSubscribe(e) {
  const w = window.open(SUBSCRIBE_URL, "incubator-subscribe", "width=540,height=720");
  if (w) e.preventDefault();
}
function ContactScreen() {
  return (
    <main className="inc-main">
      <div className="container inc-contact">
        <header className="inc-pagehead"><h1>Contact</h1></header>

        <div className="inc-contact__grid">
          <section>
            <h3>Visit</h3>
            <p>
              2 Chiltern street<br/>
              Marylebone, W1U 7PR<br/>
              <a href={MAPS_URL} target="_blank" rel="noopener">View on Google Maps ↗</a>
            </p>

            <h3>Hours</h3>
            <p>
              Mon – Wed, appointment only<br/>
              Thur – Sat, 11am – 6pm<br/>
              Sun, 11am – 5pm
            </p>

            <h3>Enquiries</h3>
            <p>
              For general enquiries, please reach out to:<br/>
              <a href="mailto:incubator.enquiries@gmail.com">incubator.enquiries@gmail.com</a>
            </p>
            <p>
              For press enquiries, please reach out to:<br/>
              <a href="mailto:fabian@strobellall.com">fabian@strobellall.com</a>
            </p>
            <p>
              Incubator is unable to accept unsolicited artist submissions. We offer a number of internship opportunities throughout the year. Please send your resume and a cover letter to <a href="mailto:incubator.enquiries@gmail.com">incubator.enquiries@gmail.com</a>.
            </p>

            <h3>Follow</h3>
            <p>
              <a href="https://www.instagram.com/__incubator__/" target="_blank" rel="noopener">@__incubator__</a>
            </p>

            <h3>Mailing list</h3>
            <p>
              <a className="inc-btn" href={SUBSCRIBE_URL} target="_blank" rel="noopener" onClick={openSubscribe}>
                Subscribe
              </a>
            </p>
          </section>

          <section>
            <h3>Find us</h3>
            <iframe
              className="inc-map"
              src={MAPS_EMBED_URL}
              title="Map showing Incubator, 2 Chiltern Street, London W1U 7PR"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="inc-map__caption">
              Nearest tube — Baker Street (5 minutes' walk) · Marylebone (8 minutes)
            </div>
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
