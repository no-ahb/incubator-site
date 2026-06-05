// Incubator — staff admin page (#/admin), unlisted (not in the public nav).
//
// Lets gallery staff add / edit / hide shows and view open issue reports.
// All writes go to the Worker, which validates the shared password SERVER-SIDE
// and commits data/shows.json + images to the repo (the site redeploys on push).
// The password gating here is convenience only — the Worker is the real lock.
//
// Images are downscaled in the browser before upload (max 1600px, JPEG) so
// uploads stay small and uniform regardless of the original camera file.

const { useState: adState, useEffect: adEffect, useRef: adRef } = React;

const ADMIN_ENDPOINT = (window.REPORT_ISSUE_ENDPOINT || "").trim();
const ADMIN_PW_KEY = "inc_admin_pw";
const AD_MAX_DIM = 1600;
const AD_JPEG_Q = 0.82;
const AD_MAX_RAW_BYTES = 25 * 1024 * 1024; // guard against reading absurd files
const AD_ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const AD_PALETTES = ["sap", "sunflower", "tobacco", "sky", "vermilion", "persimmon"];

// Downscale + re-encode an image file to a JPEG data URL.
function adResizeImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const longest = Math.max(width, height);
      if (longest > AD_MAX_DIM) {
        const scale = AD_MAX_DIM / longest;
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", AD_JPEG_Q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that image.")); };
    img.src = url;
  });
}

function adAuthFetch(path, pw, options = {}) {
  return fetch(ADMIN_ENDPOINT + path, {
    ...options,
    headers: { "X-Admin-Password": pw, ...(options.headers || {}) },
  });
}

/* ---------- LOGIN --------------------------------------------------------- */
function AdminLogin({ onAuthed }) {
  const [pw, setPw] = adState("");
  const [busy, setBusy] = adState(false);
  const [error, setError] = adState("");

  async function submit(e) {
    e.preventDefault();
    if (!pw) return;
    setBusy(true);
    setError("");
    try {
      const res = await adAuthFetch("/admin/login", pw, { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || "Sign-in failed.");
      sessionStorage.setItem(ADMIN_PW_KEY, pw);
      onAuthed(pw);
    } catch (err) {
      setError(err.message || "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <form className="inc-admin__login" onSubmit={submit}>
      <h2>Staff sign-in</h2>
      <p className="inc-admin__muted">Enter the gallery admin password to manage shows.</p>
      <input
        type="password"
        className="inc-report__input"
        placeholder="Admin password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        autoFocus
      />
      {error ? <p className="inc-report__error">{error}</p> : null}
      <button type="submit" className="inc-report__btn" disabled={busy || !pw}>
        {busy ? "Checking…" : "Sign in"}
      </button>
    </form>
  );
}

/* ---------- IMAGE PICKER -------------------------------------------------- */
// Holds a list of { key, file?, path?, url } image entries. New picks carry a
// File (uploaded on save); existing ones carry an already-committed path.
function AdminImagePicker({ label, multiple, items, onChange }) {
  const inputRef = adRef(null);
  const [err, setErr] = adState("");

  function add(files) {
    setErr("");
    const next = [];
    for (const file of files) {
      if (!AD_ALLOWED_MIME.has(file.type)) { setErr("Only PNG, JPEG, WEBP or GIF."); continue; }
      if (file.size > AD_MAX_RAW_BYTES) { setErr("That image is too large."); continue; }
      next.push({ key: file.name + ":" + file.size + ":" + file.lastModified, file, url: URL.createObjectURL(file) });
    }
    if (!next.length) return;
    onChange(multiple ? [...items, ...next] : next.slice(0, 1));
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(key) {
    onChange(items.filter((it) => it.key !== key));
  }

  return (
    <div className="inc-admin__images">
      <label className="inc-report__label">{label}</label>
      <div className="inc-admin__thumbs">
        {items.map((it) => (
          <div key={it.key} className="inc-admin__thumb">
            <img src={it.url || it.path} alt="" />
            <button type="button" className="inc-report__preview-x" aria-label="Remove image" onClick={() => remove(it.key)}>
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        ))}
        <button type="button" className="inc-admin__addimg" onClick={() => inputRef.current && inputRef.current.click()}>
          + Add
        </button>
      </div>
      {err ? <p className="inc-report__error">{err}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple={multiple}
        hidden
        onChange={(e) => add(Array.from(e.target.files || []))}
      />
    </div>
  );
}

/* ---------- SHOW FORM (add / edit) ---------------------------------------- */
function AdminShowForm({ pw, existing, onSaved, onCancel }) {
  const init = existing || {};
  const [artist, setArtist] = adState(init.artist || "");
  const [title, setTitle] = adState(init.title || "");
  const [dates, setDates] = adState(init.dates || "");
  const [startISO, setStartISO] = adState(init.startISO || "");
  const [endISO, setEndISO] = adState(init.endISO || "");
  const [current, setCurrent] = adState(!!init.current);
  const [palette, setPalette] = adState(init.palette || "sap");
  const [privateView, setPrivateView] = adState(init.privateView || "");
  const [pressRelease, setPressRelease] = adState(Array.isArray(init.pressRelease) ? init.pressRelease.join("\n\n") : (init.pressRelease || ""));
  const [artistBio, setArtistBio] = adState("");
  const [hero, setHero] = adState(init.heroImage ? [{ key: "hero", path: init.heroImage }] : []);
  const [installs, setInstalls] = adState(
    (init.installation || [])
      .filter((s) => isImageRef(s))
      .map((p, i) => ({ key: "ex" + i, path: p }))
  );
  const [busy, setBusy] = adState(false);
  const [status, setStatus] = adState("");
  const [error, setError] = adState("");

  const showId = slug(init.id || "") || slug(artist + " " + title);

  async function uploadEntry(entry) {
    if (entry.path && !entry.file) return entry.path; // already committed
    setStatus("Optimising & uploading images…");
    const dataUrl = await adResizeImage(entry.file);
    const res = await adAuthFetch("/admin/upload", pw, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl, name: entry.file.name, showId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || "Image upload failed.");
    return data.path;
  }

  async function submit(e) {
    e.preventDefault();
    if (!artist.trim() || !title.trim()) { setError("Artist and title are required."); return; }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const heroPath = hero.length ? await uploadEntry(hero[0]) : "";
      const installation = [];
      for (const it of installs) installation.push(await uploadEntry(it));

      setStatus("Saving…");
      const show = {
        id: init.id || undefined,
        artist: artist.trim(),
        title: title.trim(),
        dates: dates.trim(),
        startISO: startISO.trim(),
        endISO: endISO.trim(),
        current,
        palette,
        privateView: privateView.trim(),
        pressRelease,
        heroImage: heroPath,
        installation,
      };
      const res = await adAuthFetch("/admin/save-show", pw, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ show, artistBio }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || "Save failed.");

      onSaved({ ...show, id: data.id, artistId: slug(artist) });
    } catch (err) {
      setError(err.message || "Save failed.");
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <form className="inc-admin__form" onSubmit={submit}>
      <div className="inc-admin__formgrid">
        <label>Artist *<input className="inc-report__input" value={artist} onChange={(e) => setArtist(e.target.value)} required /></label>
        <label>Exhibition title *<input className="inc-report__input" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label>Dates (display)<input className="inc-report__input" value={dates} onChange={(e) => setDates(e.target.value)} placeholder="1 – 30 June 2026" /></label>
        <label>Palette
          <select className="inc-report__input" value={palette} onChange={(e) => setPalette(e.target.value)}>
            {AD_PALETTES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <label>Start date<input type="date" className="inc-report__input" value={startISO} onChange={(e) => setStartISO(e.target.value)} /></label>
        <label>End date<input type="date" className="inc-report__input" value={endISO} onChange={(e) => setEndISO(e.target.value)} /></label>
        <label>Private view link<input className="inc-report__input" value={privateView} onChange={(e) => setPrivateView(e.target.value)} placeholder="https://…" /></label>
        <label className="inc-admin__check"><input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} /> Current exhibition (featured on home)</label>
      </div>

      <AdminImagePicker label="Hero image (poster)" multiple={false} items={hero} onChange={setHero} />
      <AdminImagePicker label="Installation views" multiple={true} items={installs} onChange={setInstalls} />

      <label className="inc-report__label">Press release</label>
      <textarea className="inc-report__textarea" rows={8} value={pressRelease} onChange={(e) => setPressRelease(e.target.value)} placeholder="One paragraph per block, separated by a blank line." />

      <label className="inc-report__label">Artist bio {existing ? "(leave blank to keep existing)" : "(optional)"}</label>
      <textarea className="inc-report__textarea" rows={4} value={artistBio} onChange={(e) => setArtistBio(e.target.value)} placeholder="Short biography, blank line between paragraphs." />

      {error ? <p className="inc-report__error">{error}</p> : null}
      {status ? <p className="inc-admin__muted">{status}</p> : null}

      <div className="inc-admin__actions">
        <button type="submit" className="inc-report__btn" disabled={busy}>{busy ? "Working…" : existing ? "Save changes" : "Add show"}</button>
        <button type="button" className="inc-admin__btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

/* ---------- SHOWS LIST ---------------------------------------------------- */
function AdminShows({ pw, shows, onEdit, onToggle }) {
  const [busyId, setBusyId] = adState("");
  const [error, setError] = adState("");

  async function toggle(show) {
    setBusyId(show.id);
    setError("");
    try {
      const res = await adAuthFetch("/admin/visibility", pw, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: show.id, hidden: !show.hidden }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || "Update failed.");
      onToggle(show.id, !show.hidden);
    } catch (err) {
      setError(err.message || "Update failed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="inc-admin__shows">
      {error ? <p className="inc-report__error">{error}</p> : null}
      <ul className="inc-admin__list">
        {shows.map((s) => (
          <li key={s.id} className={"inc-admin__row" + (s.hidden ? " is-hidden" : "")}>
            <span className="inc-admin__row-main">
              <span className="inc-admin__row-title">{s.title ? <>{s.artist ? s.artist + " — " : ""}<em>{s.title}</em></> : (s.artist || "")}</span>
              <span className="inc-admin__row-dates">{s.dates}{s.hidden ? " · hidden" : ""}</span>
            </span>
            <span className="inc-admin__row-actions">
              <button type="button" className="inc-admin__btn-ghost" onClick={() => onEdit(s)}>Edit</button>
              <button type="button" className="inc-admin__btn-ghost" disabled={busyId === s.id} onClick={() => toggle(s)}>
                {busyId === s.id ? "…" : s.hidden ? "Unhide" : "Hide"}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- ISSUES -------------------------------------------------------- */
function AdminIssues({ pw }) {
  const [state, setState] = adState("loading"); // loading | ready | error
  const [issues, setIssues] = adState([]);
  const [error, setError] = adState("");

  function load() {
    setState("loading");
    adAuthFetch("/admin/issues", pw, { method: "GET" })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || "Could not load issues.");
        setIssues(data.issues);
        setState("ready");
      })
      .catch((err) => { setError(err.message); setState("error"); });
  }

  adEffect(() => { load(); }, []);

  if (state === "loading") return <p className="inc-admin__muted">Loading reported issues…</p>;
  if (state === "error") return <p className="inc-report__error">{error}</p>;
  if (!issues.length) return <p className="inc-admin__muted">No open issue reports. 🎉</p>;

  return (
    <ul className="inc-admin__list">
      {issues.map((it) => (
        <li key={it.number} className="inc-admin__row">
          <span className="inc-admin__row-main">
            <span className="inc-admin__row-title">#{it.number} — {it.title}</span>
            <span className="inc-admin__row-dates">{(it.createdAt || "").slice(0, 10)}{it.comments ? " · " + it.comments + " comment" + (it.comments === 1 ? "" : "s") : ""}</span>
          </span>
          <span className="inc-admin__row-actions">
            <a className="inc-admin__btn-ghost" href={it.url} target="_blank" rel="noopener">Open ↗</a>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- SCREEN -------------------------------------------------------- */
function AdminScreen() {
  const [pw, setPw] = adState(sessionStorage.getItem(ADMIN_PW_KEY) || "");
  const authed = !!pw; // signed in iff we hold a password
  const [tab, setTab] = adState("shows"); // shows | form | issues
  const [editing, setEditing] = adState(null); // show being edited, or null = new
  const [shows, setShows] = adState(() => {
    const d = (window.getSiteData && window.getSiteData()) || {};
    return Array.isArray(d.exhibitions) ? d.exhibitions.slice() : [];
  });
  const [flash, setFlash] = adState("");

  if (!ADMIN_ENDPOINT) {
    return (
      <main className="inc-main"><div className="container inc-admin">
        <h1>Admin</h1>
        <p className="inc-report__error">No Worker endpoint configured. Set <code>window.REPORT_ISSUE_ENDPOINT</code> in index.html.</p>
      </div></main>
    );
  }

  if (!authed) {
    return (
      <main className="inc-main"><div className="container inc-admin">
        <header className="inc-pagehead"><h1>Admin</h1></header>
        <AdminLogin onAuthed={(p) => setPw(p)} />
      </div></main>
    );
  }

  function signOut() {
    sessionStorage.removeItem(ADMIN_PW_KEY);
    setPw("");
  }

  function startAdd() { setEditing(null); setTab("form"); }
  function startEdit(show) { setEditing(show); setTab("form"); }

  function afterSave(saved) {
    setShows((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx >= 0) { const next = prev.slice(); next[idx] = { ...next[idx], ...saved }; return next; }
      return [saved, ...prev];
    });
    setTab("shows");
    setEditing(null);
    setFlash("Saved. The live site updates in about a minute, once it rebuilds.");
  }

  function afterToggle(id, hidden) {
    setShows((prev) => prev.map((s) => (s.id === id ? { ...s, hidden } : s)));
    setFlash((hidden ? "Hidden" : "Unhidden") + ". Live in about a minute.");
  }

  return (
    <main className="inc-main">
      <div className="container inc-admin">
        <header className="inc-admin__head">
          <h1>Admin</h1>
          <button type="button" className="inc-admin__btn-ghost" onClick={signOut}>Sign out</button>
        </header>

        <nav className="inc-admin__tabs" aria-label="Admin sections">
          <button className={tab === "shows" ? "is-active" : ""} onClick={() => { setTab("shows"); setEditing(null); }}>Shows</button>
          <button className={tab === "form" ? "is-active" : ""} onClick={startAdd}>{editing ? "Edit show" : "Add show"}</button>
          <button className={tab === "issues" ? "is-active" : ""} onClick={() => setTab("issues")}>Issues</button>
        </nav>

        {flash ? <p className="inc-admin__flash">{flash}</p> : null}

        {tab === "shows" && (
          <>
            <div className="inc-admin__bar">
              <button type="button" className="inc-report__btn" onClick={startAdd}>+ Add show</button>
            </div>
            <AdminShows pw={pw} shows={shows} onEdit={startEdit} onToggle={afterToggle} />
          </>
        )}

        {tab === "form" && (
          <AdminShowForm
            key={editing ? editing.id : "new"}
            pw={pw}
            existing={editing}
            onSaved={afterSave}
            onCancel={() => { setTab("shows"); setEditing(null); }}
          />
        )}

        {tab === "issues" && <AdminIssues pw={pw} />}
      </div>
    </main>
  );
}

Object.assign(window, { AdminScreen });
