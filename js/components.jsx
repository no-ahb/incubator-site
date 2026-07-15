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
// A frame/hero value is a real photo (vs. a "a".."f" placeholder key) when it
// looks like a path or URL. Real shows store paths like assets/shows/<id>/1.jpg.
function isImageRef(v) {
  return (
    typeof v === "string" &&
    (/^https?:\/\//.test(v) || v.includes("/") || /\.(jpe?g|png|webp|gif|avif)$/i.test(v))
  );
}

// Sort a list of full names alphabetically by last name (the last whitespace
// token). Returns a new array; the source order is left untouched.
function sortByLastName(names) {
  const lastName = (n) => n.trim().split(/\s+/).pop().toLowerCase();
  return [...names].sort((a, b) => lastName(a).localeCompare(lastName(b)));
}

// Compact one-line cast for a group show in a list row: the first few names,
// then "…and N others" once the cast is larger than a row can comfortably show
// (#98). Shows the whole list when only one name would be hidden.
function groupArtistSummary(names, max = 4) {
  const list = sortByLastName(names);
  if (list.length <= max + 1) return list.join(", ");
  const rest = list.length - max;
  return list.slice(0, max).join(", ") + " …and " + rest + " others";
}

function Tile({ kind = "a", aspect = "4/3", className = "", style = {}, alt = "" }) {
  if (isImageRef(kind)) {
    return (
      <img
        className={"inc-tile inc-tile--photo " + className}
        src={kind}
        alt={alt}
        loading="lazy"
        style={{ aspectRatio: aspect, ...style }}
      />
    );
  }
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
        // Face, weight and case come from .inc-wordmark (site.css) — only the
        // per-instance size/colour and the wider display tracking live here.
        letterSpacing: "0.18em",
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
function Header({ route, onNav, onOpenMenu, compact, menuOpen }) {
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
          className={"inc-menu-btn" + (compact ? " inc-menu-btn--show" : "") + (menuOpen ? " is-open" : "")}
          aria-label={menuOpen ? "Close menu" : "Menu"}
          aria-expanded={menuOpen ? "true" : "false"}
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
  // Shows with a real hero photo show it; the rest keep the palette identity.
  if (ex.heroImage) {
    return (
      <div className={"inc-poster inc-poster--" + size + " inc-poster--photo"}>
        <img
          className="inc-poster__img"
          src={ex.heroImage}
          alt={[ex.artist, ex.title].filter(Boolean).join(" — ") || "Exhibition"}
          loading="lazy"
        />
      </div>
    );
  }
  const cls = "inc-poster inc-poster--" + size + " palette palette--" + (ex.palette || "sap");
  return (
    <div className={cls}>
      <span className="inc-poster__wm">INCUBATOR</span>
      <span className="inc-poster__title">
        {/* A title-less (announced) solo show prints the artist's name so two
            forthcoming posters aren't identical anonymous INCUBATOR cards. */}
        {ex.title ? (ex.isGroup ? ex.title : <em>{ex.title}</em>) : (ex.artist || null)}
      </span>
      <span className="inc-poster__addr">2&nbsp;CHILTERN&nbsp;STREET, LONDON, W1U&nbsp;7PR</span>
    </div>
  );
}

/* ---------- HERO POSTER (zoomable) ---------------------------------------
   The lead image on a detail page. When the show has a real hero photo,
   clicking it opens the full image in the same lightbox the installation
   strip uses; placeholder posters stay static. */
function HeroPoster({ ex, size = "hero" }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!ex.heroImage) return <Poster ex={ex} size={size} />;

  const alt = [ex.artist, ex.title].filter(Boolean).join(" — ") || "Exhibition";
  return (
    <>
      <button
        type="button"
        className="inc-poster-zoom"
        aria-label="View full image"
        onClick={() => setOpen(true)}
      >
        <Poster ex={ex} size={size} />
      </button>
      {open && (
        <div
          className="inc-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setOpen(false)}
        >
          <button className="inc-lightbox__close" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
          <figure className="inc-lightbox__stage" onClick={(e) => e.stopPropagation()}>
            <img className="inc-lightbox__img inc-lightbox__img--photo" src={ex.heroImage} alt={alt} />
          </figure>
        </div>
      )}
    </>
  );
}

/* ---------- ENQUIRE BUTTON ------------------------------------------------
   Opens the visitor's mail client pre-addressed to the gallery with the
   artist's name in the subject and a ready-made enquiry line in the body. */
function EnquireButton({ name }) {
  const href =
    "mailto:incubator.enquiries@gmail.com" +
    "?subject=" + encodeURIComponent("Enquiry - " + name) +
    "&body=" + encodeURIComponent("I would like to enquire about available works by " + name + ".");
  return (
    <a className="inc-btn" href={href}>Enquire about available works</a>
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
        {ex.isGroup ? (ex.title ? <em>{ex.title}</em> : null) : <>{subtitle}{ex.title ? <>: <em>{ex.title}</em></> : null}</>}
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
              <span className="inc-list__name">{ex.title || ex.artist}</span>
              {(ex.groupArtists || []).length > 0 ? (
                <em className="inc-list__work">{groupArtistSummary(ex.groupArtists)}</em>
              ) : null}
            </>
          ) : (
            <>
              <span className="inc-list__name">{ex.artist}</span>
              {ex.title ? <em className="inc-list__work">{ex.title}</em> : null}
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
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
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
            <Tile kind={k} aspect="1/1" alt={"Installation view " + (i + 1)} />
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
            {/* key={open} remounts the media each step so it cross-fades
                between frames rather than hard-cutting (see .inc-lightbox__img). */}
            {isImageRef(frames[open]) ? (
              <img
                key={open}
                className="inc-lightbox__img inc-lightbox__img--photo"
                src={frames[open]}
                alt={"Installation view " + (open + 1)}
              />
            ) : (
              <Tile key={open} kind={frames[open]} aspect="3/2" className="inc-lightbox__img" />
            )}
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
    <a href={item.href} className="inc-press-item" target="_blank" rel="noopener">
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
  // Address / map / email / Instagram come from the same admin-editable contact
  // data as the Contact page (resolveContact lives in screens.jsx, global scope).
  const c = (typeof resolveContact === "function") ? resolveContact() : {};
  const mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.mapQuery || "Incubator London");
  return (
    <footer className="inc-footer">
      {/* Deliberately NOT a .container — the compact banner owns its own
          sizing (#108); .mock .container's padding/max-width would override it. */}
      <div className="inc-footer__inner">
        <div className="inc-footer__brand">
          <p>
            {(c.addressLines || []).map((line, i) => <React.Fragment key={i}>{line}<br/></React.Fragment>)}
            <a href={mapsUrl} target="_blank" rel="noopener">View map</a>
          </p>
        </div>
        <div className="inc-footer__contact">
          <p>
            <a href={"mailto:" + c.enquiriesEmail}>{c.enquiriesEmail}</a><br/>
            <a href={c.instagramUrl} target="_blank" rel="noopener">{c.instagramHandle}</a><br/>
            <a href="#" onClick={(e)=>{e.preventDefault(); onNav && onNav("/contact");}}>Subscribe to mailing list</a>
          </p>
          <div className="inc-footer__legal">&copy; 2026 Incubator</div>
        </div>
      </div>
    </footer>
  );
}

/* ---------- PROSE BLOCK ---------------------------------------------------
   Plain-text paragraphs (About intro, legacy bios) support two inline
   conventions: **bold** → <strong> and *emphasis* → <em> (e.g. italic show
   titles). Text comes from the admin form (committed to shows.json), so we
   HTML-escape first and only then apply the transforms — raw tags in the source
   can never reach the DOM (defends the public site even if the admin password
   leaks). Bold runs before italic so a `**x**` run isn't half-eaten by the
   single-star rule. */
const PROSE_ESCAPE = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => PROSE_ESCAPE[c]);
}
function proseHtml(p) {
  return escapeHtml(p)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

/* ---------- RICH TEXT (press releases & bios) -----------------------------
   Staff edit these in a small WYSIWYG (see admin.jsx) whose only output is a
   canonical, whitelist-only HTML string: block elements <p> (optionally carrying
   one of the classes attrib / byline / indent) and <blockquote>, containing only
   inline <strong>, <em>, <br> and text. Everything else is discarded. This
   renderer AND the Worker independently canonicalise the stored value, so nothing
   executable can reach the public DOM even if the admin password leaks or a
   hand-crafted payload is POSTed directly.

   Data is backward compatible: older shows still store an ARRAY of plain
   paragraph strings (rendered via the inference path below); newly-saved shows
   store the canonical HTML STRING. */
const RICH_BLOCK_CLASSES = ["attrib", "byline", "indent"];

// Serialise ONE node (text or element) to canonical inline HTML. Crucially this
// inspects the node it is given — its own <strong>/<em>/<b>/<i> tag or inline
// bold/italic style — so a formatting element survives even when it sits at the
// top level of the editor (e.g. bolding a whole paragraph yields a bare <b>…</b>
// with no <p> wrapper). Serialising only a node's *children* here would silently
// drop that wrapper, which is exactly what stopped bold/italic from saving.
function richInlineNode(n) {
  if (n.nodeType === 3) return escapeHtml(n.nodeValue);
  if (n.nodeType !== 1) return "";
  const tag = n.tagName;
  if (tag === "BR") return "<br>";
  if (tag === "STRONG" || tag === "B") return "<strong>" + richInline(n) + "</strong>";
  if (tag === "EM" || tag === "I") return "<em>" + richInline(n) + "</em>";
  // Bold/italic conveyed via inline style rather than a semantic tag — e.g.
  // execCommand's <span style="font-weight:bold"> or pasted content — is mapped
  // to <strong>/<em> so the formatting survives canonicalisation. Only the
  // decision is read from the style; the style itself is never emitted.
  const st = n.style || {};
  const fw = String(st.fontWeight || "");
  const bold = fw === "bold" || fw === "bolder" || (/^\d+$/.test(fw) && parseInt(fw, 10) >= 600);
  const italic = st.fontStyle === "italic" || st.fontStyle === "oblique";
  let inner = richInline(n); // unknown element: keep its text, drop the tag
  if (italic) inner = "<em>" + inner + "</em>";
  if (bold) inner = "<strong>" + inner + "</strong>";
  return inner;
}

// Serialise a node's inline *content* (its children) to canonical HTML.
function richInline(node) {
  let out = "";
  node.childNodes.forEach((n) => { out += richInlineNode(n); });
  return out;
}

// Parse a stored value (canonical or messy HTML) into [{ role, cls, html }].
// role ∈ {para, quote}; cls ∈ {"", attrib, byline, indent}; html is safe inline.
function richBlocks(html) {
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  const blocks = [];
  let pending = "";
  // A block with only <br>/whitespace (e.g. the empty contenteditable's
  // "<p><br></p>") carries no content and is dropped, so an empty editor
  // canonicalises to "" rather than a junk empty paragraph.
  const isBlank = (s) => !s.replace(/<br\s*\/?>/gi, "").trim();
  const flush = () => {
    if (!isBlank(pending)) blocks.push({ role: "para", cls: "", html: pending.trim() });
    pending = "";
  };
  doc.body.childNodes.forEach((n) => {
    if (n.nodeType === 3) { pending += escapeHtml(n.nodeValue); return; }
    if (n.nodeType !== 1) return;
    const tag = n.tagName;
    const isBlock = tag === "P" || tag === "DIV" || tag === "BLOCKQUOTE" ||
      tag === "LI" || /^H[1-6]$/.test(tag);
    if (!isBlock) { pending += richInlineNode(n); return; }
    flush();
    const role = tag === "BLOCKQUOTE" ? "quote" : "para";
    let cls = "";
    if (role === "para" && n.classList) {
      cls = RICH_BLOCK_CLASSES.find((c) => n.classList.contains(c)) || "";
    }
    const inner = richInline(n).trim();
    if (!isBlank(inner)) blocks.push({ role, cls, html: inner });
  });
  flush();
  return blocks;
}

// Re-emit the canonical HTML string for storage / comparison.
function canonicalizeRichHtml(html) {
  return richBlocks(html)
    .map((b) =>
      b.role === "quote"
        ? "<blockquote>" + b.html + "</blockquote>"
        : "<p" + (b.cls ? ' class="' + b.cls + '"' : "") + ">" + b.html + "</p>"
    )
    .join("");
}

// Maps a block's optional class to the concrete CSS class per variant.
const RELEASE_PARA_CLASS = {
  attrib: "inc-release__attrib",
  byline: "inc-release__byline",
  indent: "inc-release__para inc-release__para--indent",
  "": "inc-release__para",
};
const PROSE_PARA_CLASS = { indent: "inc-prose__p--indent" };

// Render a stored value as React. variant "release" applies the press-release
// role styling; "prose" is plain body prose (bios, etc.).
function RichContent({ value, variant }) {
  const blocks = richBlocks(value);
  const release = variant === "release";
  return (
    <div className={release ? "inc-prose inc-release" : "inc-prose"}>
      {blocks.map((b, i) => {
        if (b.role === "quote") {
          const qc = release ? "inc-release__quote" : "inc-prose__quote";
          return <blockquote key={i} className={qc} dangerouslySetInnerHTML={{ __html: b.html }} />;
        }
        const cls = release
          ? RELEASE_PARA_CLASS[b.cls] || RELEASE_PARA_CLASS[""]
          : PROSE_PARA_CLASS[b.cls] || null;
        return <p key={i} className={cls} dangerouslySetInnerHTML={{ __html: b.html }} />;
      })}
    </div>
  );
}

// A rich value should be a canonical HTML STRING (new) or a plain-text
// paragraph ARRAY (legacy). A stale Worker, though, can save the editor's HTML
// string wrapped in a 1-element array (["<p>…</p><p>…</p>"]). Left alone, the
// legacy array path would HTML-escape it and the page would show literal "<p>"
// tags. Detect array elements that already carry canonical markup and re-join
// them into the HTML string they always were; richBlocks re-sanitises on render,
// so this stays a strict whitelist. Genuine plain-text arrays are untouched.
// A closing block tag is the reliable fingerprint of the editor's canonical
// output (every block is wrapped, e.g. "<p>…</p>"). Plain-text gallery prose
// never contains one, so this won't misfire on a legacy paragraph that happens
// to include a stray "<b>" or "<" — those keep the escaped legacy path.
const RICH_HTML_MARKER = /<\/(p|blockquote)>/i;
function coerceRichValue(value) {
  if (Array.isArray(value) && value.some((el) => typeof el === "string" && RICH_HTML_MARKER.test(el))) {
    return value.join("");
  }
  return value;
}

function Prose({ paragraphs, max }) {
  // Newly-saved bios are a canonical HTML string; legacy bios are string arrays.
  paragraphs = coerceRichValue(paragraphs);
  if (typeof paragraphs === "string") {
    return <RichContent value={paragraphs} variant="prose" />;
  }
  return (
    <div className="inc-prose" style={max ? { maxWidth: max } : null}>
      {(paragraphs || []).map((p, i) => (
        <p key={i} dangerouslySetInnerHTML={{ __html: proseHtml(p) }} />
      ))}
    </div>
  );
}

/* ---------- PRESS RELEASE -------------------------------------------------
   A press release is set like published editorial text rather than a flat run
   of paragraphs. Each source paragraph carries a typographic role that we infer
   from its shape, so the same plain-text data renders with proper quote blocks,
   attributions and a colophon byline:

     • quote   — a paragraph wholly enclosed in quotation marks (an epigraph or
                 pulled quotation). Set as a <blockquote> with a hung opening
                 mark and italic face.
     • attrib  — a dash-led line ("– Name, source") that credits a quote.
     • byline  — the closing "Written by …" credit, set off with a rule.
     • body    — ordinary prose, set with novel-style first-line indents.

   Roles are presentation only; classification is deliberately conservative so a
   normal paragraph is never mistaken for a quote. */
const OPEN_QUOTES = "“„«‘‚\"'"; // “ „ « ‘ ‚ " '
const CLOSE_QUOTES = "”»’\"'"; //          ” » ’ " '
const ATTRIB_START = /^[‒–—―−-]\s+\S/; // ‒ – — ― − - + space
function classifyPara(p) {
  const t = String(p).trim();
  if (!t) return "body";
  if (/^(?:written|words|text|curated|edited)\s+by\b/i.test(t)) return "byline";
  if (ATTRIB_START.test(t)) return "attrib";
  const first = t.charAt(0);
  const last = t.charAt(t.length - 1);
  // A "quote" is a paragraph fully wrapped in matching quotation marks — a
  // stray inline quote inside running prose must not trigger it.
  if (OPEN_QUOTES.includes(first) && CLOSE_QUOTES.includes(last) && t.length > 1)
    return "quote";
  return "body";
}
// Second pass over the whole release: a run of consecutive lines that opens with
// a quotation mark and closes with one, capped by an attribution, is a single
// (possibly multi-line / verse) quotation even though no individual line is
// wholly wrapped. This lets a broken-across-lines epigraph set as one block.
function classifyParagraphs(paragraphs) {
  const roles = paragraphs.map(classifyPara);
  const startsOpen = (p) => { const t = String(p).trim(); return !!t && OPEN_QUOTES.includes(t.charAt(0)); };
  const endsClose = (p) => { const t = String(p).trim(); return !!t && CLOSE_QUOTES.includes(t.charAt(t.length - 1)); };
  for (let i = 0; i < roles.length; i++) {
    if (roles[i] !== "attrib") continue;
    // The quote ends on the body line just above the attribution and must close
    // with a quotation mark.
    const end = i - 1;
    if (end < 0 || roles[end] !== "body" || !endsClose(paragraphs[end])) continue;
    // Walk back only until the line that OPENS the quote — don't swallow the
    // unrelated body paragraphs that precede it.
    let start = end;
    while (start >= 0 && roles[start] === "body" && !startsOpen(paragraphs[start])) start--;
    if (start < 0 || roles[start] !== "body" || !startsOpen(paragraphs[start])) continue;
    for (let j = start; j <= end; j++) roles[j] = "quote";
  }
  return roles;
}
// Some legacy releases glue the byline onto the end of the final paragraph
// (e.g. "…their loss, not ours.” Written by Orla Brennan") instead of giving it
// its own line. Split a trailing credit off so it can be set as a byline. The
// match is deliberately strict — a capitalised credit form, a short name with no
// full stop, at the very end, after sentence-ending punctuation — so a phrase
// like "a list written by your mum" mid-sentence is never split.
const TRAILING_BYLINE = /^([\s\S]*[.!?”"’')\]])\s+((?:Written|Words|Text|Photography|Curated|Edited)\s+by\s+[^.]{1,60})\s*$/;
function splitTrailingByline(paras) {
  if (!paras || !paras.length) return paras || [];
  const last = String(paras[paras.length - 1]);
  const m = last.match(TRAILING_BYLINE);
  if (!m) return paras;
  const out = paras.slice(0, -1);
  if (m[1].trim()) out.push(m[1].trim());
  out.push(m[2].trim());
  return out;
}

// Convert a legacy paragraph-array press release to canonical rich HTML, reusing
// the inference above so existing content opens in the editor already structured.
function releaseArrayToRichHtml(input) {
  const paras = splitTrailingByline(input);
  const roles = classifyParagraphs(paras);
  let out = "";
  for (let i = 0; i < paras.length; i++) {
    if (roles[i] === "quote") {
      const lines = [];
      while (i < paras.length && roles[i] === "quote") { lines.push(proseHtml(paras[i])); i++; }
      i--;
      out += "<blockquote>" + lines.join("<br>") + "</blockquote>";
      continue;
    }
    const cls = roles[i] === "attrib" ? ' class="attrib"' : roles[i] === "byline" ? ' class="byline"' : "";
    out += "<p" + cls + ">" + proseHtml(paras[i]) + "</p>";
  }
  return out;
}
// Legacy bios have no quotes/attributions — straight paragraphs only.
function proseArrayToRichHtml(paras) {
  return (paras || []).map((p) => "<p>" + proseHtml(p) + "</p>").join("");
}

function PressRelease({ paragraphs }) {
  // Both shapes render through one path: a canonical HTML string renders directly;
  // a legacy paragraph array is first converted (inferring quotes/attributions/
  // byline) to the same canonical HTML.
  paragraphs = coerceRichValue(paragraphs);
  const html = typeof paragraphs === "string"
    ? paragraphs
    : releaseArrayToRichHtml(paragraphs || []);
  return <RichContent value={html} variant="release" />;
}

Object.assign(window, {
  Tile, Wordmark, Header, Poster, HeroPoster, EnquireButton, isImageRef,
  ExhibitionCard, ExhibitionsListRow,
  InstallationStrip, PressItem, Footer, Prose, PressRelease, RichContent,
});
// Rich-text helpers shared with the admin editor (admin.jsx loads after this).
window.RichText = {
  canonicalize: canonicalizeRichHtml,
  fromRelease: (v) => { v = coerceRichValue(v); return typeof v === "string" ? canonicalizeRichHtml(v) : releaseArrayToRichHtml(v || []); },
  fromProse: (v) => { v = coerceRichValue(v); return typeof v === "string" ? canonicalizeRichHtml(v) : proseArrayToRichHtml(v || []); },
};
