// Incubator — real site shell.
// Replaces the artboard "stacked viewer" from mockups.html with a working
// client-side router, a functioning mobile menu, and per-route scroll reset.
// All page-type screens + components + data are reused unchanged.

const { useState: appState, useEffect: appEffect } = React;

/* ---------- MOBILE MENU OVERLAY ------------------------------------------
   Uses the design system's .inc-overlay styles (site.css). Shown when the
   compact-header "Menu" button is tapped on narrow viewports. */
function MobileMenu({ onNav, onClose }) {
  const items = [
    ["/exhibitions", "Exhibitions"],
    ["/press", "Press"],
    ["/about", "About"],
    ["/contact", "Contact"],
  ];

  appEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="inc-overlay" role="dialog" aria-modal="true" aria-label="Menu">
      <div className="inc-overlay__head container">
        <a
          className="inc-header__brand"
          href="/"
          onClick={(e) => { e.preventDefault(); onNav("/"); }}
        >
          <Wordmark />
        </a>
        <button className="inc-overlay__close" aria-label="Close menu" onClick={onClose}>
          <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>✕</span>
        </button>
      </div>

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
        <span>2 Chiltern Street, Marylebone W1U 7PR</span>
        <a href="https://www.instagram.com/__incubator__/" target="_blank" rel="noopener">
          @__incubator__
        </a>
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
    default:        return <HomeScreen onNav={navigate} />;
  }
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

  const navigate = (path) => {
    const target = "#" + path;
    if (window.location.hash !== target) {
      window.location.hash = target; // fires hashchange -> updates route
    } else {
      setRoute(getRoute());
      window.scrollTo(0, 0);
    }
    setMenuOpen(false);
  };

  appEffect(() => {
    const onHash = () => {
      setRoute(getRoute());
      setMenuOpen(false);
      window.scrollTo(0, 0);
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

  return (
    <div className="mock" data-route={route}>
      <Header
        route={route}
        onNav={navigate}
        onOpenMenu={() => setMenuOpen(true)}
      />
      <div className="mock__scroll">
        {routeToScreen(route, navigate)}
        <Footer onNav={navigate} />
      </div>
      {menuOpen && <MobileMenu onNav={navigate} onClose={() => setMenuOpen(false)} />}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
