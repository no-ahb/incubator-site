// Incubator — real site shell.
// Replaces the artboard "stacked viewer" from mockups.html with a working
// client-side router, a functioning mobile menu, and per-route scroll reset.
// All page-type screens + components + data are reused unchanged.

const { useState: appState, useEffect: appEffect, useLayoutEffect: appLayout } = React;

const prefersReducedMotion = () =>
  !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

// Route changes cross-fade via the View Transitions API where available: the
// old page dissolves straight into the new one instead of flashing to white
// and fading in. flushSync makes React commit inside the transition's snapshot
// window. Elsewhere (and under reduced motion) the update applies directly and
// the CSS enter animation (.mock__view) covers the change.
const withViewTransition = (apply) => {
  if (document.startViewTransition && !prefersReducedMotion()) {
    document.startViewTransition(() => { ReactDOM.flushSync(apply); });
  } else {
    apply();
  }
};

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
      // Focus the panel itself (tabIndex -1), not the first link — focusing the
      // link paints a focus ring on "Exhibitions" every time the menu opens on
      // touch devices (#109). Keyboard users tab straight into the first link.
      const panel = document.querySelector(".inc-overlay__nav");
      if (panel) panel.focus({ preventScroll: true });
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
      <nav className="inc-overlay__nav container" aria-label="Primary" tabIndex={-1}>
        <ul>
          {items.map(([path, label]) => (
            <li key={path}>
              <a href={pagePath(path)} onClick={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault(); onNav(path);
              }}>
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
  const seg = cleanRoute(route).split("/").filter(Boolean);

  if (!publicRoutes(SITE_DATA).includes(cleanRoute(route)) && route !== "/admin") return <NotFoundScreen onNav={navigate} />;
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
    default:        return <NotFoundScreen onNav={navigate} />;
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

// Old hash links are still accepted, then normalised to the public page URL.
function getRoute() {
  const h = window.location.hash.slice(1);
  const route = cleanRoute(h.startsWith("/") ? h : window.location.pathname);
  return route === "/artists" ? "/" : route;
}
function updateMetadata(route) {
  const meta = pageMetadata(route, SITE_DATA);
  document.title = meta.title;
  for (const [selector, value] of [
    ['meta[name="description"]',meta.description], ['meta[property="og:title"]',meta.title],
    ['meta[property="og:description"]',meta.description], ['meta[property="og:url"]',meta.url],
    ['meta[property="og:image"]',meta.image], ['meta[name="twitter:title"]',meta.title],
    ['meta[name="twitter:description"]',meta.description], ['meta[name="twitter:image"]',meta.image],
    ['meta[name="robots"]', meta.noindex ? "noindex, follow" : "index, follow"]
  ]) document.querySelector(selector)?.setAttribute("content",value);
  document.querySelector('link[rel="canonical"]')?.setAttribute("href",meta.url);
  const schema = document.getElementById("site-schema");
  if (schema) schema.textContent = JSON.stringify(meta.jsonld);
}

function App() {
  const [route, setRoute] = appState(getRoute());
  const [menuOpen, setMenuOpen] = appState(false);
  const [dataState, setDataState] = appState(SITE_DATA && getRoute() !== "/admin" ? "ready" : "loading"); // loading | ready | error
  const [, refreshDate] = appState(0);

  const loadData = () => {
    setDataState("loading");
    loadSiteData()
      .then(() => withViewTransition(() => setDataState("ready")))
      .catch(() => setDataState("error"));
  };

  const navigate = (path) => {
    const route = cleanRoute(path);
    if (getRoute() !== route) history.pushState(null, "", pagePath(route));
    withViewTransition(() => {
      setRoute(route);
      setMenuOpen(false);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
  };

  appEffect(() => {
    if (!SITE_DATA || getRoute() === "/admin") loadData();
    // The first client render uses the build date to match the static HTML.
    // Immediately refresh and keep date-based statuses correct across midnight.
    delete window.__RENDER_DATE__;
    refreshDate(n => n + 1);
    const timer = setInterval(() => refreshDate(n => n + 1), 60000);
    return () => clearInterval(timer);
  }, []);
  appEffect(() => {
    if (route === "/admin" && dataState === "ready") loadData();
  }, [route]);

  appEffect(() => {
    const onRoute = () => {
      const next = getRoute();
      if (window.location.hash.startsWith("#/")) history.replaceState(null, "", pagePath(next));
      withViewTransition(() => {
        setRoute(next);
        setMenuOpen(false);
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      });
    };
    window.addEventListener("hashchange", onRoute);
    window.addEventListener("popstate", onRoute);
    return () => { window.removeEventListener("hashchange", onRoute); window.removeEventListener("popstate", onRoute); };
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

  appEffect(() => {
    if (dataState === "ready") updateMetadata(route);
  }, [route, dataState]);

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
    </div>
  );
}

if (window.__SERVER_RENDER__) {
  window.renderSite = () => <App />;
} else {
  const node = document.getElementById("root");
  const originalRoute = node.firstElementChild?.getAttribute("data-route");
  const route = getRoute();
  if (window.location.hash.startsWith("#/")) history.replaceState(null, "", pagePath(route));
  if (originalRoute === route) ReactDOM.hydrateRoot(node, <App />);
  else ReactDOM.createRoot(node).render(<App />);
}
