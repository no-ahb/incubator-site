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

// Build the human date string shown across the site from the ISO pickers, so
// staff never hand-type it. "2026-06-01"+"2026-06-30" -> "1 – 30 June 2026".
// Reuses monthName() from screens.jsx (shared global scope).
function adFormatDates(startISO, endISO) {
  const parse = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
    return m ? { y: +m[1], mo: +m[2] - 1, d: +m[3], iso: m[0] } : null;
  };
  const one = (p) => p.d + " " + monthName(p.iso) + " " + p.y;
  const s = parse(startISO), e = parse(endISO);
  if (!s && !e) return "";
  if (!s) return one(e);
  if (!e) return one(s);
  if (s.y === e.y && s.mo === e.mo) return s.d + " – " + e.d + " " + monthName(e.iso) + " " + e.y;
  if (s.y === e.y) return s.d + " " + monthName(s.iso) + " – " + e.d + " " + monthName(e.iso) + " " + e.y;
  return one(s) + " – " + one(e);
}

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
  const [isGroup, setIsGroup] = adState(!!init.isGroup);
  const [artist, setArtist] = adState(init.artist || "");
  const [title, setTitle] = adState(init.title || "");
  const [groupArtists, setGroupArtists] = adState(Array.isArray(init.groupArtists) ? init.groupArtists.join("\n") : "");
  const [startISO, setStartISO] = adState(init.startISO || "");
  const [endISO, setEndISO] = adState(init.endISO || "");
  const [privateView, setPrivateView] = adState(init.privateView || "");
  const [pressRelease, setPressRelease] = adState(Array.isArray(init.pressRelease) ? init.pressRelease.join("\n\n") : (init.pressRelease || ""));
  // Pre-fill the artist bio from the stored artist record so staff can see and
  // edit the current text, rather than facing a blank "leave blank to keep" box.
  const [artistBio, setArtistBio] = adState(() => {
    const aid = init.artistId || (init.artist ? slug(init.artist) : "");
    const d = (window.getSiteData && window.getSiteData()) || {};
    const rec = Array.isArray(d.artists) ? d.artists.find((a) => a.id === aid) : null;
    const bio = rec && rec.bio;
    return Array.isArray(bio) ? bio.join("\n\n") : (bio || "");
  });
  const [hero, setHero] = adState(init.heroImage ? [{ key: "hero", path: init.heroImage }] : []);
  const [installs, setInstalls] = adState(
    (init.installation || [])
      .filter((s) => isImageRef(s))
      .map((p, i) => ({ key: "ex" + i, path: p }))
  );
  const [busy, setBusy] = adState(false);
  const [status, setStatus] = adState("");
  const [error, setError] = adState("");

  const showId = slug(init.id || "") || slug(isGroup ? title : artist + " " + title);

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
    // Group shows have no single artist: the exhibition title names the show and
    // the participant list carries the artists. Solo shows keep the artist field.
    const showArtist = isGroup ? title.trim() : artist.trim();
    if (!title.trim() || (!isGroup && !artist.trim())) {
      setError(isGroup ? "Exhibition title is required." : "Artist and title are required.");
      return;
    }
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
        isGroup,
        artist: showArtist,
        title: title.trim(),
        groupArtists: isGroup ? groupArtists.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean) : [],
        dates: adFormatDates(startISO, endISO) || init.dates || "",
        startISO: startISO.trim(),
        endISO: endISO.trim(),
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

      onSaved({ ...show, id: data.id, artistId: isGroup ? null : slug(showArtist) });
    } catch (err) {
      setError(err.message || "Save failed.");
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <form className="inc-admin__form" onSubmit={submit}>
      <label className="inc-admin__check"><input type="checkbox" checked={isGroup} onChange={(e) => setIsGroup(e.target.checked)} /> Group show (multiple artists)</label>

      <div className="inc-admin__formgrid">
        {!isGroup && <label>Artist *<input className="inc-report__input" value={artist} onChange={(e) => setArtist(e.target.value)} required /></label>}
        <label>Exhibition title *<input className="inc-report__input" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
        <label>Start date<input type="date" className="inc-report__input" value={startISO} onChange={(e) => setStartISO(e.target.value)} /></label>
        <label>End date<input type="date" className="inc-report__input" value={endISO} onChange={(e) => setEndISO(e.target.value)} /></label>
        <label>Private view link<input className="inc-report__input" value={privateView} onChange={(e) => setPrivateView(e.target.value)} placeholder="https://…" /></label>
      </div>

      {isGroup && (
        <>
          <label className="inc-report__label">Participating artists</label>
          <textarea className="inc-report__textarea" rows={5} value={groupArtists} onChange={(e) => setGroupArtists(e.target.value)} placeholder="One name per line (or comma-separated)." />
        </>
      )}

      <AdminImagePicker label="Hero image (poster)" multiple={false} items={hero} onChange={setHero} />
      <AdminImagePicker label="Installation views" multiple={true} items={installs} onChange={setInstalls} />

      <label className="inc-report__label">Press release</label>
      <textarea className="inc-report__textarea" rows={8} value={pressRelease} onChange={(e) => setPressRelease(e.target.value)} placeholder="One paragraph per block, separated by a blank line." />

      {!isGroup && (
        <>
          <label className="inc-report__label">Artist bio</label>
          <textarea className="inc-report__textarea" rows={6} value={artistBio} onChange={(e) => setArtistBio(e.target.value)} placeholder="Short biography, blank line between paragraphs." />
        </>
      )}

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
              <span className="inc-admin__row-title">{s.isGroup ? <em>{s.title || s.artist}</em> : s.title ? <>{s.artist ? s.artist + " — " : ""}<em>{s.title}</em></> : (s.artist || "")}</span>
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

/* ---------- PAGE-CONTENT FORMS (About / Contact / Press) ------------------ */
// Upload one picked image entry (reuses the show-image flow). Returns its path,
// or the already-committed path when the entry wasn't re-picked.
async function adUploadContentImage(pw, entry, dir) {
  if (!entry) return "";
  if (entry.path && !entry.file) return entry.path;
  const dataUrl = await adResizeImage(entry.file);
  const res = await adAuthFetch("/admin/upload", pw, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: dataUrl, name: entry.file.name, showId: dir }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || "Image upload failed.");
  return data.path;
}

function adSiteData() {
  return (window.getSiteData && window.getSiteData()) || {};
}

/* ABOUT --------------------------------------------------------------------- */
function AdminAboutForm({ pw, onSaved }) {
  const fallback = (typeof DEFAULT_ABOUT !== "undefined" && DEFAULT_ABOUT) || { paragraphs: [], image: "", team: [] };
  const init = adSiteData().about || fallback;
  const [paragraphs, setParagraphs] = adState(Array.isArray(init.paragraphs) ? init.paragraphs.join("\n\n") : "");
  const [image, setImage] = adState(init.image ? [{ key: "about", path: init.image }] : []);
  const [team, setTeam] = adState(Array.isArray(init.team) && init.team.length ? init.team.map((m) => ({ ...m })) : [{ name: "", role: "" }]);
  const [busy, setBusy] = adState(false);
  const [status, setStatus] = adState("");
  const [error, setError] = adState("");

  function setMember(i, key, val) { setTeam((t) => t.map((m, j) => (j === i ? { ...m, [key]: val } : m))); }
  function addMember() { setTeam((t) => [...t, { name: "", role: "" }]); }
  function removeMember(i) { setTeam((t) => t.filter((_, j) => j !== i)); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(""); setStatus("");
    try {
      if (image.length && image[0].file) setStatus("Optimising & uploading image…");
      const imagePath = image.length ? await adUploadContentImage(pw, image[0], "about") : "";
      setStatus("Saving…");
      const about = {
        paragraphs: paragraphs.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
        image: imagePath,
        team: team.map((m) => ({ name: m.name.trim(), role: m.role.trim() })).filter((m) => m.name || m.role),
      };
      const res = await adAuthFetch("/admin/save-content", pw, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ about }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || "Save failed.");
      onSaved();
    } catch (err) {
      setError(err.message || "Save failed."); setBusy(false); setStatus("");
    }
  }

  return (
    <form className="inc-admin__form" onSubmit={submit}>
      <label className="inc-report__label">Intro paragraphs</label>
      <textarea className="inc-report__textarea" rows={8} value={paragraphs} onChange={(e) => setParagraphs(e.target.value)} placeholder="One paragraph per block, separated by a blank line." />

      <AdminImagePicker label="Gallery photo" multiple={false} items={image} onChange={setImage} />

      <label className="inc-report__label">Team</label>
      {team.map((m, i) => (
        <div key={i} className="inc-admin__formgrid" style={{ alignItems: "end" }}>
          <label>Name<input className="inc-report__input" value={m.name} onChange={(e) => setMember(i, "name", e.target.value)} /></label>
          <label>Role<input className="inc-report__input" value={m.role} onChange={(e) => setMember(i, "role", e.target.value)} /></label>
          <button type="button" className="inc-admin__btn-ghost" onClick={() => removeMember(i)}>Remove</button>
        </div>
      ))}
      <div><button type="button" className="inc-admin__btn-ghost" onClick={addMember}>+ Add person</button></div>

      {error ? <p className="inc-report__error">{error}</p> : null}
      {status ? <p className="inc-admin__muted">{status}</p> : null}
      <div className="inc-admin__actions">
        <button type="submit" className="inc-report__btn" disabled={busy}>{busy ? "Working…" : "Save About page"}</button>
      </div>
    </form>
  );
}

/* CONTACT ------------------------------------------------------------------- */
function AdminContactForm({ pw, onSaved }) {
  const fallback = (typeof DEFAULT_CONTACT !== "undefined" && DEFAULT_CONTACT) || {};
  const init = { ...fallback, ...(adSiteData().contact || {}) };
  const [f, setF] = adState({
    addressLines: (init.addressLines || []).join("\n"),
    hours: (init.hours || []).join("\n"),
    enquiriesEmail: init.enquiriesEmail || "",
    pressEmail: init.pressEmail || "",
    internshipText: init.internshipText || "",
    instagramUrl: init.instagramUrl || "",
    instagramHandle: init.instagramHandle || "",
    mailingListUrl: init.mailingListUrl || "",
    mapQuery: init.mapQuery || "",
    mapCaption: init.mapCaption || "",
  });
  const [busy, setBusy] = adState(false);
  const [error, setError] = adState("");
  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const splitLines = (s) => s.split(/\n+/).map((x) => x.trim()).filter(Boolean);
      const contact = {
        ...f,
        addressLines: splitLines(f.addressLines),
        hours: splitLines(f.hours),
      };
      const res = await adAuthFetch("/admin/save-content", pw, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || "Save failed.");
      onSaved();
    } catch (err) {
      setError(err.message || "Save failed."); setBusy(false);
    }
  }

  return (
    <form className="inc-admin__form" onSubmit={submit}>
      <label className="inc-report__label">Address (one line per row)</label>
      <textarea className="inc-report__textarea" rows={3} value={f.addressLines} onChange={set("addressLines")} />

      <label className="inc-report__label">Opening hours (one line per row)</label>
      <textarea className="inc-report__textarea" rows={3} value={f.hours} onChange={set("hours")} />

      <div className="inc-admin__formgrid">
        <label>General enquiries email<input className="inc-report__input" value={f.enquiriesEmail} onChange={set("enquiriesEmail")} /></label>
        <label>Press enquiries email<input className="inc-report__input" value={f.pressEmail} onChange={set("pressEmail")} /></label>
        <label>Instagram handle<input className="inc-report__input" value={f.instagramHandle} onChange={set("instagramHandle")} placeholder="@…" /></label>
        <label>Instagram link<input className="inc-report__input" value={f.instagramUrl} onChange={set("instagramUrl")} placeholder="https://…" /></label>
        <label>Mailing-list link<input className="inc-report__input" value={f.mailingListUrl} onChange={set("mailingListUrl")} placeholder="https://…" /></label>
        <label>Map search location<input className="inc-report__input" value={f.mapQuery} onChange={set("mapQuery")} placeholder="Address for Google Maps" /></label>
      </div>

      <label className="inc-report__label">Internship / submissions note</label>
      <textarea className="inc-report__textarea" rows={3} value={f.internshipText} onChange={set("internshipText")} />

      <label className="inc-report__label">Map caption</label>
      <input className="inc-report__input" value={f.mapCaption} onChange={set("mapCaption")} placeholder="e.g. Nearest tube — Baker Street…" />

      {error ? <p className="inc-report__error">{error}</p> : null}
      <div className="inc-admin__actions">
        <button type="submit" className="inc-report__btn" disabled={busy}>{busy ? "Working…" : "Save Contact page"}</button>
      </div>
    </form>
  );
}

/* PRESS --------------------------------------------------------------------- */
function AdminPressForm({ pw, onSaved }) {
  const init = Array.isArray(adSiteData().press) ? adSiteData().press : [];
  const [groups, setGroups] = adState(
    init.length
      ? init.map((g) => ({ year: String(g.year || ""), items: (g.items || []).map((it) => ({ date: it.date || "", pub: it.pub || "", title: it.title || "", href: it.href || "" })) }))
      : []
  );
  const [busy, setBusy] = adState(false);
  const [error, setError] = adState("");

  const mutate = (fn) => setGroups((gs) => fn(gs.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it })) }))));
  function addYear() { mutate((gs) => [...gs, { year: "", items: [{ date: "", pub: "", title: "", href: "" }] }]); }
  function removeYear(gi) { mutate((gs) => gs.filter((_, i) => i !== gi)); }
  function setYear(gi, val) { mutate((gs) => { gs[gi].year = val; return gs; }); }
  function addItem(gi) { mutate((gs) => { gs[gi].items.push({ date: "", pub: "", title: "", href: "" }); return gs; }); }
  function removeItem(gi, ii) { mutate((gs) => { gs[gi].items = gs[gi].items.filter((_, j) => j !== ii); return gs; }); }
  function setItem(gi, ii, key, val) { mutate((gs) => { gs[gi].items[ii][key] = val; return gs; }); }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const press = groups.map((g) => ({
        year: parseInt(g.year, 10) || 0,
        items: g.items.map((it) => ({ date: it.date.trim(), pub: it.pub.trim(), title: it.title.trim(), href: it.href.trim() })).filter((it) => it.title || it.pub || it.href),
      })).filter((g) => g.year && g.items.length);
      const res = await adAuthFetch("/admin/save-content", pw, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ press }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error((data && data.error) || "Save failed.");
      onSaved();
    } catch (err) {
      setError(err.message || "Save failed."); setBusy(false);
    }
  }

  return (
    <form className="inc-admin__form" onSubmit={submit}>
      {groups.length === 0 && <p className="inc-admin__muted">No press items yet. Add a year to begin.</p>}
      {groups.map((g, gi) => (
        <div key={gi} className="inc-admin__pressyear" style={{ borderTop: "1px solid var(--line, #ddd)", paddingTop: "var(--s-4)", marginTop: "var(--s-4)" }}>
          <div className="inc-admin__formgrid" style={{ alignItems: "end" }}>
            <label>Year<input className="inc-report__input" value={g.year} onChange={(e) => setYear(gi, e.target.value)} placeholder="2026" /></label>
            <button type="button" className="inc-admin__btn-ghost" onClick={() => removeYear(gi)}>Remove year</button>
          </div>
          {g.items.map((it, ii) => (
            <div key={ii} className="inc-admin__formgrid" style={{ alignItems: "end" }}>
              <label>Date<input className="inc-report__input" value={it.date} onChange={(e) => setItem(gi, ii, "date", e.target.value)} placeholder="e.g. March 2026" /></label>
              <label>Publication<input className="inc-report__input" value={it.pub} onChange={(e) => setItem(gi, ii, "pub", e.target.value)} /></label>
              <label>Title<input className="inc-report__input" value={it.title} onChange={(e) => setItem(gi, ii, "title", e.target.value)} /></label>
              <label>Link<input className="inc-report__input" value={it.href} onChange={(e) => setItem(gi, ii, "href", e.target.value)} placeholder="https://…" /></label>
              <button type="button" className="inc-admin__btn-ghost" onClick={() => removeItem(gi, ii)}>Remove</button>
            </div>
          ))}
          <div><button type="button" className="inc-admin__btn-ghost" onClick={() => addItem(gi)}>+ Add article</button></div>
        </div>
      ))}
      <div style={{ marginTop: "var(--s-4)" }}><button type="button" className="inc-report__btn" onClick={addYear}>+ Add year</button></div>

      {error ? <p className="inc-report__error">{error}</p> : null}
      <div className="inc-admin__actions">
        <button type="submit" className="inc-report__btn" disabled={busy}>{busy ? "Working…" : "Save Press page"}</button>
      </div>
    </form>
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

  function afterContentSave() {
    setFlash("Saved. The live site updates in about a minute, once it rebuilds.");
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
          <button className={tab === "about" ? "is-active" : ""} onClick={() => { setTab("about"); setEditing(null); }}>About</button>
          <button className={tab === "contact" ? "is-active" : ""} onClick={() => { setTab("contact"); setEditing(null); }}>Contact</button>
          <button className={tab === "press" ? "is-active" : ""} onClick={() => { setTab("press"); setEditing(null); }}>Press</button>
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

        {tab === "about" && <AdminAboutForm pw={pw} onSaved={afterContentSave} />}
        {tab === "contact" && <AdminContactForm pw={pw} onSaved={afterContentSave} />}
        {tab === "press" && <AdminPressForm pw={pw} onSaved={afterContentSave} />}

        {tab === "issues" && <AdminIssues pw={pw} />}
      </div>
    </main>
  );
}

Object.assign(window, { AdminScreen });
