// Incubator mockup — shared components.
// Forked from the design system UI kit, asset paths localised to ./assets/.

const { useState, useEffect, useRef } = React;

/* ---------- TILE ----------------------------------------------------------
   Coloured placeholder standing in for installation / hero photography.
   Variants approximate the warm-neutral palette of the gallery's photography. */
const TILE_BG = {
  "warm-1": "linear-gradient(135deg,#cfc7bf 0%,#988a7d 100%)",
  "warm-2": "linear-gradient(135deg,#e2dad0 0%,#a89886 100%)",
  "warm-3": "linear-gradient(135deg,#d4ccc1 0%,#8b7e6f 100%)",
  "warm-4": "linear-gradient(135deg,#c9bfb3 0%,#7e7363 100%)",
  "cool-1": "linear-gradient(135deg,#dad6cf 0%,#8d9a8e 100%)",
  "cool-2": "linear-gradient(135deg,#cdd0cc 0%,#7a8780 100%)",
  a: "linear-gradient(135deg,#cfc7bf 0%,#988a7d 100%)",
  b: "linear-gradient(135deg,#dad6cf 0%,#8d9a8e 100%)",
  c: "linear-gradient(135deg,#eae6df 0%,#a8a097 100%)",
  d: "linear-gradient(135deg,#bcb4ac 0%,#736b62 100%)",
  e: "linear-gradient(135deg,#e0dcd5 0%,#9c958c 100%)",
  f: "linear-gradient(135deg,#cac3bc 0%,#7a7167 100%)",
};
function Tile({ kind = "a", aspect = "4/3", className = "", style = {} }) {
  return (
    <div
      className={"inc-tile " + className}
      style={{
        background: TILE_BG[kind] || TILE_BG.a,
        aspectRatio: aspect,
        ...style,
      }}
    />
  );
}

/* ---------- WORDMARK -----------------------------------------------------
   Text-set wordmark — matches the design system's typographic treatment so
   it never warps with the parent and always picks up the surrounding colour. */
function Wordmark({ size = 20, color, className = "", as: Tag = "span", style }) {
  return (
    <Tag
      className={"inc-wordmark " + className}
      style={{
        fontFamily: "var(--font-serif)",
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        fontSize: size,
        color: color || "var(--green)",
        lineHeight: 1,
        ...style,
      }}
    >
      INCUBATOR
    </Tag>
  );
}

/* ---------- HEADER ------------------------------------------------------- */
function Header({ route, onNav, onOpenMenu, compact }) {
  const items = [
    { id: "exhibitions", label: "Exhibitions" },
    { id: "press",       label: "Press" },
    { id: "about",       label: "About" },
    { id: "contact",     label: "Contact" },
  ];
  const activeId = route.split("/")[1] || "";
  return (
    <header className={"inc-header" + (compact ? " inc-header--compact" : "")}>
      <div className="inc-header__inner container">
        <a
          href="#/"
          className="inc-header__brand"
          onClick={(e) => { e.preventDefault(); onNav && onNav("/"); }}
        >
          <Wordmark />
        </a>

        {!compact && (
          <nav className="inc-header__nav" aria-label="Primary">
            <ul>
              {items.map((it) => (
                <li key={it.id}>
                  <a
                    href={"#/" + it.id}
                    className={activeId === it.id ? "is-active" : ""}
                    onClick={(e) => { e.preventDefault(); onNav && onNav("/" + it.id); }}
                  >
                    {it.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <button
          className={"inc-menu-btn" + (compact ? " inc-menu-btn--show" : "")}
          aria-label="Menu"
          onClick={onOpenMenu}
        >
          <span className="inc-menu-btn__ic" aria-hidden="true">
            <span></span><span></span><span></span>
          </span>
          <span className="inc-menu-btn__txt">Menu</span>
        </button>
      </div>
    </header>
  );
}

/* ---------- POSTER -------------------------------------------------------- */
function Poster({ ex, size = "card" }) {
  const cls = "inc-poster inc-poster--" + size + " palette palette--" + (ex.palette || "sap");
  return (
    <div className={cls}>
      <span className="inc-poster__wm">INCUBATOR</span>
      <span className="inc-poster__title">
        {ex.isGroup ? ex.title : <em>{ex.title}</em>}
      </span>
      <span className="inc-poster__addr">2&nbsp;CHILTERN&nbsp;STREET, LONDON, W1U&nbsp;7PR</span>
    </div>
  );
}

/* ---------- EXHIBITION CARD (legacy grid — used on home) ----------------- */
function ExhibitionCard({ ex, onNav, eyebrow }) {
  const subtitle = ex.isGroup ? "Group show" : ex.artist;
  return (
    <a
      className="inc-card"
      href={"#/exhibitions/" + ex.id}
      onClick={(e) => { e.preventDefault(); onNav && onNav("/exhibitions/" + ex.id); }}
    >
      <Poster ex={ex} size="card" />
      <div className="inc-card__meta">
        {eyebrow ? <span className="inc-card__flag">{eyebrow}</span> : null}
        <span className="inc-card__dates">{ex.dates}</span>
      </div>
      <h3 className="inc-card__title">
        {ex.isGroup ? <em>{ex.title}</em> : <>{subtitle}: <em>{ex.title}</em></>}
      </h3>
    </a>
  );
}

/* ---------- EXHIBITIONS LIST ROW (new — adopted from Artists list) --------
   Two-line typographic layout:  artist name on top, italic show title beneath.
   Dates pinned to the right on desktop; stack beneath on narrow viewports. */
function ExhibitionsListRow({ ex, onNav, onHover }) {
  return (
    <li className="inc-list__row">
      <a
        className="inc-list__link"
        href={"#/exhibitions/" + ex.id}
        onMouseEnter={() => onHover && onHover(ex)}
        onFocus={() => onHover && onHover(ex)}
        onClick={(e) => { e.preventDefault(); onNav && onNav("/exhibitions/" + ex.id); }}
      >
        <span className="inc-list__title">
          {ex.isGroup ? (
            <>
              <span className="inc-list__name">Group show</span>
              <em className="inc-list__work">{ex.title}</em>
            </>
          ) : (
            <>
              <span className="inc-list__name">{ex.artist}</span>
              <em className="inc-list__work">{ex.title}</em>
            </>
          )}
        </span>
        <span className="inc-list__dates">{ex.dates}</span>
      </a>
    </li>
  );
}

/* ---------- INSTALLATION STRIP --------------------------------------------
   A row of installation views. Each opens a full-screen lightbox you can
   step through with the arrow keys or the on-screen ‹ › controls. */
function InstallationStrip({ frames }) {
  const [open, setOpen] = useState(-1);
  const count = frames.length;
  const go = (delta) => setOpen((i) => (i + delta + count) % count);

  useEffect(() => {
    if (open < 0) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(-1);
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft")  { e.preventDefault(); go(-1); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, count]);

  return (
    <>
      <div className="inc-strip">
        {frames.map((k, i) => (
          <button
            key={i}
            type="button"
            className="inc-strip__btn"
            aria-label={"Open installation view " + (i + 1) + " of " + count}
            onClick={() => setOpen(i)}
          >
            <Tile kind={k} aspect={i % 3 === 0 ? "4/3" : "3/4"} />
          </button>
        ))}
      </div>

      {open >= 0 && (
        <div
          className="inc-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Installation views"
          onClick={() => setOpen(-1)}
        >
          <button className="inc-lightbox__close" aria-label="Close" onClick={() => setOpen(-1)}>✕</button>
          {count > 1 && (
            <button
              className="inc-lightbox__nav inc-lightbox__nav--prev"
              aria-label="Previous view"
              onClick={(e) => { e.stopPropagation(); go(-1); }}
            >‹</button>
          )}
          <figure className="inc-lightbox__stage" onClick={(e) => e.stopPropagation()}>
            <Tile kind={frames[open]} aspect="3/2" className="inc-lightbox__img" />
            <figcaption className="inc-lightbox__caption">{(open + 1) + " / " + count}</figcaption>
          </figure>
          {count > 1 && (
            <button
              className="inc-lightbox__nav inc-lightbox__nav--next"
              aria-label="Next view"
              onClick={(e) => { e.stopPropagation(); go(1); }}
            >›</button>
          )}
        </div>
      )}
    </>
  );
}

/* ---------- PRESS ITEM ---------------------------------------------------- */
function PressItem({ item }) {
  return (
    <a href={item.href} className="inc-press-item">
      <span className="inc-press-item__date">{item.date}</span>
      <span className="inc-press-item__pub">{item.pub}</span>
      <span className="inc-press-item__title">{item.title}</span>
      <span className="inc-press-item__cta">Read ↗</span>
    </a>
  );
}

/* ---------- FOOTER --------------------------------------------------------
   Text-only — no logo image, no seal, no Artlogic credit.
   Instagram is a single line: @__incubator__, clickable. */
function Footer({ onNav }) {
  return (
    <footer className="inc-footer">
      <div className="container inc-footer__inner">
        <div className="inc-footer__brand">
          <p>
            2 Chiltern street<br/>
            Marylebone, W1U 7PR<br/>
            <a href="#" onClick={(e)=>e.preventDefault()}>View map</a>
          </p>
        </div>
        <div>
          <p>
            Mon &ndash; Wed, appointment only<br/>
            Thur &ndash; Sat, 11am &ndash; 6pm<br/>
            Sun, 11am &ndash; 5pm
          </p>
        </div>
        <div className="inc-footer__contact">
          <p>
            <a href="mailto:incubator.enquiries@gmail.com">incubator.enquiries@gmail.com</a><br/>
            <a href="https://www.instagram.com/__incubator__/" target="_blank" rel="noopener">@__incubator__</a><br/>
            <a href="#" onClick={(e)=>{e.preventDefault(); onNav && onNav("/contact");}}>Subscribe to mailing list</a>
          </p>
          <div className="inc-footer__legal">&copy; 2026 Incubator</div>
        </div>
      </div>
    </footer>
  );
}

/* ---------- PROSE BLOCK --------------------------------------------------- */
function Prose({ paragraphs, max }) {
  return (
    <div className="inc-prose" style={max ? { maxWidth: max } : null}>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          dangerouslySetInnerHTML={{
            __html: p.replace(/\*([^*]+)\*/g, "<em>$1</em>"),
          }}
        />
      ))}
    </div>
  );
}

Object.assign(window, {
  Tile, Wordmark, Header, Poster,
  ExhibitionCard, ExhibitionsListRow,
  InstallationStrip, PressItem, Footer, Prose,
});
