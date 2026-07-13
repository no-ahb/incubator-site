// Incubator — real site shell.
// Replaces the artboard "stacked viewer" from mockups.html with a working
// client-side router, a functioning mobile menu, and per-route scroll reset.
// All page-type screens + components + data are reused unchanged.

const { useState: appState, useEffect: appEffect, useLayoutEffect: appLayout } = React;

const prefersReducedMotion = () =>
  !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

/* ---------- MOBILE MENU OVERLAY ------------------------------------------
   Uses the design system's .inc-overlay styles (site.css). Shown when the
   compact-header "Menu" button is tapped on narrow viewports. */
function MobileMenu({ open, onNav, onClose }) {
  const items = [
    ["/exhibitions", "Exhibitions"],
    ["/press", "Press"],
    ["/about", "About"],
    ["/contact", "Contact"],
  ];

  appEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Move focus into the panel when it opens and hand it back to the header
  // toggle when it closes, so keyboard/AT users follow the menu (the close
  // control is the header hamburger, which lives outside this panel). The ref
  // guard skips the initial mount so we never steal focus on page load.
  const wasOpen = React.useRef(false);
  appEffect(() => {
    if (open) {
      wasOpen.current = true;
      const first = document.querySelector(".inc-overlay__nav a");
      if (first) first.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      const btn = document.querySelector(".inc-menu-btn");
      if (btn) btn.focus();
    }
  }, [open]);

  // Kept mounted so the panel can unfold/roll-up both ways. It sits just below
  // the real header and never covers the INCUBATOR sign — the header hamburger
  // (which morphs to a ✕) is the close control, so there's no duplicate wordmark
  // to flash. Not aria-modal: the toggle/close lives outside the panel, so we
  // keep it in the AT flow rather than fencing it off. See .inc-overlay (site.css).
  return (
    <div
      className={"inc-overlay" + (open ? " is-open" : "")}
      role="dialog"
      aria-label="Menu"
      aria-hidden={open ? undefined : "true"}
    >
      <nav className="inc-overlay__nav container" aria-label="Primary">
        <ul>
          {items.map(([path, label]) => (
            <li key={path}>
              <a href={path} onClick={(e) => { e.preventDefault(); onNav(path); }}>
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="inc-overlay__foot container">
        {(() => {
          // Same admin-editable contact data as the footer / Contact page.
          const c = (typeof resolveContact === "function") ? resolveContact() : {};
          return (
            <>
              <span>{(c.addressLines || []).join(", ")}</span>
              <a href={c.instagramUrl} target="_blank" rel="noopener">
                {c.instagramHandle}
              </a>
            </>
          );
        })()}
      </div>
    </div>
  );
}

/* ---------- ROUTER -------------------------------------------------------- */
function routeToScreen(route, navigate) {
  const seg = route.split("/").filter(Boolean);

  if (seg.length === 0) return <HomeScreen onNav={navigate} />;

  switch (seg[0]) {
    case "exhibitions":
      return seg[1]
        ? <ExhibitionDetailScreen id={seg[1]} onNav={navigate} />
        : <ExhibitionsListScreen onNav={navigate} />;
    case "artists":
      return seg[1]
        ? <ArtistScreen id={seg[1]} onNav={navigate} />
        : <HomeScreen onNav={navigate} />;
    case "press":   return <PressScreen />;
    case "about":   return <AboutScreen />;
    case "contact": return <ContactScreen />;
    case "admin":   return <AdminScreen />;
    default:        return <HomeScreen onNav={navigate} />;
  }
}

/* ---------- DATA LOADING / ERROR STATES ----------------------------------- */
function SiteLoading() {
  return (
    <main className="inc-main inc-datastate" aria-busy="true">
      <div className="container inc-datastate__inner">
        <Wordmark />
        <p className="inc-datastate__msg">Loading…</p>
      </div>
    </main>
  );
}

function SiteError({ onRetry }) {
  return (
    <main className="inc-main inc-datastate">
      <div className="container inc-datastate__inner">
        <Wordmark />
        <p className="inc-datastate__msg">We couldn’t load the gallery right now.</p>
        <button type="button" className="inc-btn" onClick={onRetry}>Try again</button>
      </div>
    </main>
  );
}

// Route lives in the hash (e.g. "#/exhibitions/foo") so the site works on any
// static host and survives a refresh on a deep link. Hashes that don't start
// with "/" are treated as in-page anchors, not routes.
function getRoute() {
  const h = window.location.hash.replace(/^#/, "");
  return h.startsWith("/") ? h : "/";
}

function App() {
  const [route, setRoute] = appState(getRoute());
  const [menuOpen, setMenuOpen] = appState(false);
  const [dataState, setDataState] = appState("loading"); // loading | ready | error

  const loadData = () => {
    setDataState("loading");
    loadSiteData()
      .then(() => setDataState("ready"))
      .catch(() => setDataState("error"));
  };

  const navigate = (path) => {
    const target = "#" + path;
    if (window.location.hash !== target) {
      window.location.hash = target; // fires hashchange -> updates route
    } else {
      setRoute(getRoute());
      // Instant, not smooth: `html { scroll-behavior: smooth }` (app.css) would
      // otherwise animate this reset, and the scroll-reveal layout effect would
      // then measure element positions before the page returned to the top.
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    setMenuOpen(false);
  };

  // Fetch site content (shows + artists) once on mount.
  appEffect(() => { loadData(); }, []);

  appEffect(() => {
    const onHash = () => {
      setRoute(getRoute());
      setMenuOpen(false);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" }); // see navigate()
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // In-page anchor links inside the screens (#installation, #release,
  // #biography, #show-N) must scroll without disturbing the route hash.
  appEffect(() => {
    const onClick = (e) => {
      const a = e.target.closest && e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (href && href.startsWith("#") && !href.startsWith("#/")) {
        const el = document.getElementById(href.slice(1));
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  // Lock background scroll while the mobile menu is open.
  appEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Scroll-reveal: fade grid/list items up as they enter the viewport. The
  // hidden start state is added here by JS (never in base CSS) so content stays
  // visible if scripts fail, and is skipped wholesale under reduced-motion.
  // Runs after each route render / once data is ready; above-the-fold items are
  // left untouched so they never flash. Layout effect => no first-paint flicker.
  appLayout(() => {
    if (dataState !== "ready") return;
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) return;
    const scope = document.querySelector(".mock__scroll");
    if (!scope) return;
    const targets = scope.querySelectorAll(".inc-card, .inc-list__row, .inc-press-item");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("inc-reveal--in");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    const fold = window.innerHeight * 0.9;
    targets.forEach((el) => {
      if (el.getBoundingClientRect().top < fold) return; // already in view
      el.classList.add("inc-reveal");
      io.observe(el);
    });
    return () => io.disconnect();
  }, [route, dataState]);

  let content;
  if (dataState === "loading") {
    content = <SiteLoading />;
  } else if (dataState === "error") {
    content = <SiteError onRetry={loadData} />;
  } else {
    content = (
      <>
        {routeToScreen(route, navigate)}
        <Footer onNav={navigate} />
      </>
    );
  }

  return (
    <div className="mock" data-route={route}>
      <Header
        route={route}
        onNav={navigate}
        onOpenMenu={() => setMenuOpen((v) => !v)}
        menuOpen={menuOpen}
      />
      <div className="mock__scroll">
        {/* Keyed so the route-enter animation replays on every navigation and
            when data finishes loading (see .mock__view in site.css). */}
        <div className="mock__view" key={route + "|" + dataState}>{content}</div>
      </div>
      <MobileMenu open={menuOpen} onNav={navigate} onClose={() => setMenuOpen(false)} />
      <ReportIssue />
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
