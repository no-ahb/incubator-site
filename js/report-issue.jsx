// Incubator — "Report an issue" widget.
// A floating button + modal available on every page so any visitor or team
// member can log something they notice. On submit it creates a GitHub issue.
//
// Two modes, chosen automatically:
//   1. Endpoint mode  — if window.REPORT_ISSUE_ENDPOINT is set (a deployed
//      serverless proxy that holds a GitHub token), the report is POSTed there
//      and the issue is created automatically, screenshot and all. No GitHub
//      account needed by the reporter.
//   2. Fallback mode  — if no endpoint is configured, the form opens GitHub's
//      prefilled "New issue" page in a new tab. Works with zero backend, but
//      the reporter needs a GitHub account and screenshots can't auto-attach.
//
// Config (set on window before this script runs, e.g. inline in index.html):
//   window.REPORT_ISSUE_ENDPOINT — URL of the deployed Worker (enables mode 1)
//   window.REPORT_ISSUE_REPO     — "owner/repo" for the fallback link / labels

// Distinct hook aliases: top-level `const`s share one lexical scope across the
// text/babel scripts, so re-declaring `useState` here would collide with
// components.jsx. (Same reason app.jsx aliases its hooks.)
const { useState: riState, useRef: riRef, useEffect: riEffect } = React;

const REPORT_ISSUE_ENDPOINT = (window.REPORT_ISSUE_ENDPOINT || "").trim();
const REPORT_ISSUE_REPO = (window.REPORT_ISSUE_REPO || "no-ahb/incubator-site").trim();
const REPORT_ISSUE_LABEL = "site-report";

const RI_MAX_BYTES = 5 * 1024 * 1024;
const RI_ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function riReadFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

// Diagnostic context captured at submit time — helps whoever triages the issue
// reproduce it without a back-and-forth.
function riCaptureContext() {
  const dpr = window.devicePixelRatio || 1;
  return {
    page: window.location.href,
    route: window.location.hash || "(home)",
    viewport: `${window.innerWidth}x${window.innerHeight}${dpr !== 1 ? ` @${dpr}x` : ""}`,
    userAgent: window.navigator.userAgent,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    locale: window.navigator.language || "",
    time: new Date().toISOString(),
  };
}

// Markdown body shared by both modes.
function riBuildBody(description, ctx, hasScreenshot) {
  return [
    description.trim(),
    "",
    "---",
    "**Reported from the live site**",
    "",
    `- Page: ${ctx.page}`,
    `- Route: ${ctx.route}`,
    `- Viewport: ${ctx.viewport}`,
    `- Timezone / locale: ${[ctx.timezone, ctx.locale].filter(Boolean).join(" · ")}`,
    `- User agent: ${ctx.userAgent}`,
    `- Time: ${ctx.time}`,
    hasScreenshot ? "\n_Screenshot attached above._" : "",
  ].join("\n");
}

function riDeriveTitle(title, description) {
  const t = title.trim();
  if (t) return t;
  const firstLine = description.trim().split("\n")[0].trim();
  const base = firstLine || "Site issue report";
  return base.length > 70 ? base.slice(0, 67) + "…" : base;
}

function ReportIssue() {
  const [open, setOpen] = riState(false);
  const [title, setTitle] = riState("");
  const [description, setDescription] = riState("");
  const [screenshot, setScreenshot] = riState(null); // File
  const [previewUrl, setPreviewUrl] = riState(null);  // object URL for <img>
  const [dragOver, setDragOver] = riState(false);
  const [submitting, setSubmitting] = riState(false);
  const [error, setError] = riState("");
  const [result, setResult] = riState(null); // { url, number } | { fallback: true }
  const fileInputRef = riRef(null);

  // Bind an object URL to the chosen file for preview; revoke on change/unmount.
  riEffect(() => {
    if (!screenshot) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  // Close on Escape; lock background scroll while open.
  riEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function reset() {
    setTitle("");
    setDescription("");
    setScreenshot(null);
    setDragOver(false);
    setSubmitting(false);
    setError("");
    setResult(null);
  }

  function close() {
    setOpen(false);
    // Reset after the modal is gone so content doesn't flicker on the way out.
    setTimeout(reset, 200);
  }

  function attachImage(file) {
    if (!file) return;
    if (!RI_ALLOWED_MIME.has(file.type)) {
      setError("Only PNG, JPEG, WEBP, or GIF images.");
      return;
    }
    if (file.size > RI_MAX_BYTES) {
      setError("Image must be under 5 MB.");
      return;
    }
    setError("");
    setScreenshot(file);
  }

  function onPickFile(e) {
    attachImage(e.target.files && e.target.files[0]);
    e.target.value = "";
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    attachImage(e.dataTransfer.files && e.dataTransfer.files[0]);
  }

  function onPaste(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        attachImage(item.getAsFile());
        e.preventDefault();
        return;
      }
    }
  }

  async function submitViaEndpoint(payloadTitle, body, ctx) {
    let screenshotDataUrl = null;
    if (screenshot) screenshotDataUrl = await riReadFileAsDataUrl(screenshot);

    const res = await fetch(REPORT_ISSUE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: payloadTitle,
        body,
        context: ctx,
        screenshot: screenshotDataUrl,
        screenshotName: screenshot ? screenshot.name : null,
      }),
    });

    let data = null;
    try { data = await res.json(); } catch (_) { /* non-JSON error body */ }
    if (!res.ok || !data || !data.ok) {
      throw new Error((data && data.error) || `Request failed (${res.status})`);
    }
    return { url: data.url, number: data.number };
  }

  function submitViaFallback(payloadTitle, body) {
    const url =
      `https://github.com/${REPORT_ISSUE_REPO}/issues/new` +
      `?title=${encodeURIComponent(payloadTitle)}` +
      `&body=${encodeURIComponent(body)}` +
      `&labels=${encodeURIComponent(REPORT_ISSUE_LABEL)}`;
    window.open(url, "_blank", "noopener");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) {
      setError("Please describe the issue.");
      return;
    }
    setSubmitting(true);
    setError("");

    const ctx = riCaptureContext();
    const payloadTitle = riDeriveTitle(title, description);
    const body = riBuildBody(description, ctx, !!screenshot && !!REPORT_ISSUE_ENDPOINT);

    try {
      if (REPORT_ISSUE_ENDPOINT) {
        const created = await submitViaEndpoint(payloadTitle, body, ctx);
        setResult(created);
      } else {
        submitViaFallback(payloadTitle, body);
        setResult({ fallback: true });
      }
    } catch (err) {
      setError(err && err.message ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <React.Fragment>
      <button
        type="button"
        className="inc-report-fab"
        aria-label="Report an issue"
        onClick={() => setOpen(true)}
      >
        <span className="inc-report-fab__mark" aria-hidden="true">!</span>
        <span className="inc-report-fab__txt">Report an issue</span>
      </button>

      {open && (
        <div
          className="inc-report-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Report an issue"
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <div className="inc-report" onPaste={!result ? onPaste : undefined}>
            <div className="inc-report__head">
              <h2 className="inc-report__title">
                {result ? "Thank you" : "Report an issue"}
              </h2>
              <button
                type="button"
                className="inc-report__close"
                aria-label="Close"
                onClick={close}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            {result ? (
              <div className="inc-report__done">
                {result.fallback ? (
                  <p>
                    A prefilled GitHub issue page has opened in a new tab.
                    Review it and press <strong>Submit new issue</strong> to finish.
                    {screenshot ? " You can paste your screenshot into the issue there." : ""}
                  </p>
                ) : (
                  <p>
                    Your report was logged
                    {result.number ? (
                      <>
                        {" as "}
                        <a href={result.url} target="_blank" rel="noopener">
                          issue #{result.number}
                        </a>
                      </>
                    ) : null}
                    . Thanks for helping improve the site.
                  </p>
                )}
                <button type="button" className="inc-report__btn" onClick={close}>
                  Close
                </button>
              </div>
            ) : (
              <form className="inc-report__form" onSubmit={handleSubmit}>
                <label className="inc-report__label" htmlFor="ri-title">
                  Title <span className="inc-report__hint">(optional)</span>
                </label>
                <input
                  id="ri-title"
                  type="text"
                  className="inc-report__input"
                  placeholder="Short summary"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <label className="inc-report__label" htmlFor="ri-desc">
                  What's the issue? <span className="inc-report__req">*</span>
                </label>
                <textarea
                  id="ri-desc"
                  className="inc-report__textarea"
                  placeholder="What were you doing, and what went wrong or looks off?"
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  autoFocus
                  required
                />

                <label className="inc-report__label">
                  Screenshot{" "}
                  <span className="inc-report__hint">(optional — paste, drag, or browse)</span>
                </label>
                {previewUrl ? (
                  <div className="inc-report__preview">
                    <img src={previewUrl} alt="Screenshot preview" />
                    <button
                      type="button"
                      className="inc-report__preview-x"
                      aria-label="Remove screenshot"
                      onClick={() => setScreenshot(null)}
                    >
                      <span aria-hidden="true">✕</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={"inc-report__drop" + (dragOver ? " is-over" : "")}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={onDrop}
                  >
                    <span className="inc-report__drop-main">
                      Drop an image, paste from clipboard, or click to browse
                    </span>
                    <span className="inc-report__drop-sub">PNG, JPEG, WEBP, GIF · up to 5 MB</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hidden
                  onChange={onPickFile}
                />

                {error ? <p className="inc-report__error">{error}</p> : null}

                <button
                  type="submit"
                  className="inc-report__btn"
                  disabled={submitting || !description.trim()}
                >
                  {submitting ? "Sending…" : "Send report"}
                </button>
                {!REPORT_ISSUE_ENDPOINT ? (
                  <p className="inc-report__note">
                    Opens a prefilled GitHub issue you confirm with one click.
                  </p>
                ) : null}
              </form>
            )}
          </div>
        </div>
      )}
    </React.Fragment>
  );
}

Object.assign(window, { ReportIssue });
