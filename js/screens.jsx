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
              {current.artist}:&nbsp;<em>{current.title}</em>
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
              {next.isGroup ? <em>{next.title}</em> : <>{next.artist}:&nbsp;<em>{next.title}</em></>}
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
                      ? <em>{preview.title}</em>
                      : <>{preview.artist} · <em>{preview.title}</em></>
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
              : <>{artistRec ? artistLink(ex.artist) : ex.artist}: <em>{ex.title}</em></>}
          </h1>
          <div className="inc-meta">{ex.dates}</div>

          {ex.isGroup && (
            <div className="inc-participants">
              <span className="inc-participants__label">With</span>
              {(ex.participants || ["Charlie Gosling", "Harry Grundy", "Katherine Qiyu Su", "Xiaochi Dong", "Lorena Levi", "Leonard \u201CSoldier\u201D Iheagwam"]).map((n) => (
                <a
                  key={n}
                  href={"#/artists/" + slug(n)}
                  onClick={(e) => { e.preventDefault(); onNav("/artists/" + slug(n)); }}
                >
                  {n}
                </a>
              ))}
            </div>
          )}

          <div className="inc-jumps">
            <a href="#installation">Installation views</a>
            <a href="#release">Press release</a>
          </div>
        </div>

        <section id="installation" className="container inc-detail__installation">
          <h3>Installation views</h3>
          <InstallationStrip frames={ex.installation || ["a","b","c","d","e","f"]} />
        </section>

        <section id="release" className="container inc-detail__release">
          <h3>Press release</h3>
          <Prose paragraphs={ex.pressRelease || []} />
        </section>

        {(otherShows.length > 0 || artistRec) && (
          <section className="container inc-related">
            <h3>
              {otherShows.length > 0
                ? "Other exhibitions by " + ex.artist + " at Incubator"
                : "Artist"}
            </h3>
            <div className="inc-related__items">
              {otherShows.map((o) => (
                <div key={o.id} className="inc-related__row">
                  <a
                    className="inc-related__link"
                    href={"#/exhibitions/" + o.id}
                    onClick={(e) => { e.preventDefault(); onNav("/exhibitions/" + o.id); }}
                  >
                    <span className="inc-related__title"><em>{o.title}</em></span>
                    <span className="inc-related__dates">{o.dates}</span>
                  </a>
                </div>
              ))}
            </div>
            {artistRec && (
              <p className="inc-detail__more" style={{ marginTop: "var(--s-5)" }}>
                {artistLink("View " + ex.artist + "’s full profile →")}
              </p>
            )}
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
              <h2><em>{ex.title}</em></h2>
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
            For press enquiries, please write to{" "}
            <a href="mailto:incubator.enquiries@gmail.com">incubator.enquiries@gmail.com</a>.
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
        <Prose
          paragraphs={[
            "*Incubator* is a highly adrenalised exhibition programme showcasing the work of the most exceptional emerging artists working in London.",
            "Founded as a vehicle for solo and small-group exhibitions of artists in the first phase of their public practice, Incubator runs a programme of roughly twelve shows a year from a single-room gallery on Chiltern Street in Marylebone. Each exhibition is accompanied by a press release written either by the artist, by a critic, or by the gallery.",
            "The programme is built around close, sustained relationships with a small group of painters whose work the gallery believes will become essential. Many artists return — *Charlie Gosling*, for instance, has shown twice — and each return marks an attempt to track a practice in real time, not to recapitulate it.",
            "The gallery is open to the public Thursday to Sunday. Mondays through Wednesdays are by appointment only — please write ahead."
          ]}
        />

        <section className="container inc-detail__bio" style={{ paddingInline: 0, marginTop: "var(--s-16)" }}>
          <h3>Founders &amp; staff</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--s-3) var(--s-10)", fontSize: 16, maxWidth: 720 }}>
            <span><strong>Eliza Bonham Carter</strong></span><span>Founder &amp; Director</span>
            <span><strong>Beatrice Wakeling</strong></span><span>Curator</span>
            <span><strong>Anna Souter</strong></span><span>Gallery manager</span>
          </div>
        </section>

        <section className="container inc-detail__bio" style={{ paddingInline: 0, marginTop: "var(--s-12)" }}>
          <h3>With thanks to</h3>
          <p style={{ fontSize: 16, lineHeight: 1.6, maxWidth: 720 }}>
            Arts Council England · The Elephant Trust · The Royal Drawing School · Sarabande Foundation · and the many private supporters who make the programme possible.
          </p>
        </section>
      </article>
    </main>
  );
}

/* =====================================================================
   CONTACT  (new page)
   ===================================================================== */
function ContactScreen() {
  const [email, setEmail] = msState("");
  const [sent, setSent]   = msState(false);
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
              <a href="#" onClick={(e)=>e.preventDefault()}>View on Google Maps ↗</a>
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
            <p>Receive exhibition announcements roughly once a month. No other contact.</p>
            <form className="inc-form" onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
              <label htmlFor="ml-email">Your email</label>
              <input
                id="ml-email" type="email" required
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <button className="inc-btn" type="submit">{sent ? "Subscribed" : "Subscribe"}</button>
            </form>
          </section>

          <section>
            <h3>Find us</h3>
            <div className="inc-map" role="img" aria-label="Map showing 2 Chiltern Street" />
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
});
