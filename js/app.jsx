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

// Route now lives in the real URL path (e.g. "/exhibitions/foo") so every page
// is a distinct, crawlable URL that the prerender build (build/prerender.mjs)
// emits as static HTML. Legacy hash links ("#/exhibitions/foo") are still
// honoured and rewritten to the clean path on load, so old bookmarks/shares work.
function getRoute() {
  const hash = window.location.hash || "";
  if (hash.startsWith("#/")) return hash.slice(1); // legacy #/… deep link
  const p = window.location.pathname.replace(/\/+$/, ""); // trim trailing slash
  return p === "" ? "/" : p;
}

function App() {
  const [route, setRoute] = appState(getRoute());
  const [menuOpen, setMenuOpen] = appState(false);
  // Prerendered pages ship data inline (js/data.jsx boots it synchronously), so
  // we can render immediately with no loading flash. Only pages without inline
  // data (or a bare shell) start in "loading".
  const [dataState, setDataState] = appState(getSiteData() ? "ready" : "loading");

  const loadData = () => {
    const haveData = !!getSiteData();
    if (!haveData) setDataState("loading");
    loadSiteData()
      .then(() => setDataState("ready"))
      // Keep showing inline data if a background refresh fails; only error when
      // we have nothing to show.
      .catch(() => setDataState(getSiteData() ? "ready" : "error"));
  };

  const navigate = (path) => {
    if (getRoute() !== path) {
      window.history.pushState({}, "", path);
    }
    setRoute(path);
    // Instant, not smooth: `html { scroll-behavior: smooth }` (app.css) would
    // otherwise animate this reset, and the scroll-reveal layout effect would
    // then measure element positions before the page returned to the top.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setMenuOpen(false);
  };

  // Rewrite any legacy hash deep link to the clean path once, on mount. Data is
  // normally already loaded before the app mounts (see mountApp below), so we
  // only fetch here to recover if that pre-mount load failed.
  appEffect(() => {
    if (window.location.hash.startsWith("#/")) {
      window.history.replaceState({}, "", getRoute());
    }
    if (dataState !== "ready") loadData();
  }, []);

  // Back/forward through History-API navigations.
  appEffect(() => {
    const onPop = () => {
      setRoute(getRoute());
      setMenuOpen(false);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" }); // see navigate()
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
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

function mountApp() {
  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
}

// Prerendered pages paint full content into #root before any JS runs. To swap
// that static content for the live app in a single step — no "Loading…" flash,
// no yank — we wait for site data before the first mount. The App still starts
// in "ready" (getSiteData() is set by then) and renders the same content. If the
// pre-mount fetch fails we mount anyway and App's effect retries / shows an error.
if (getSiteData()) {
  mountApp();
} else {
  loadSiteData().then(mountApp, mountApp);
}
