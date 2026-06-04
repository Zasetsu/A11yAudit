export const WIDGET_CSS = `
:host {
  position: fixed;
  z-index: 2147483647;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #111827;
  display: flex;
  flex-direction: column;
}

:host([data-position="bottom-right"]) {
  right: 16px;
  bottom: 16px;
  align-items: flex-end;
}

:host([data-position="bottom-left"]) {
  left: 16px;
  bottom: 16px;
  align-items: flex-start;
}

:host([data-position="top-right"]) {
  right: 16px;
  top: 16px;
  align-items: flex-end;
}

:host([data-position="top-left"]) {
  left: 16px;
  top: 16px;
  align-items: flex-start;
}

* {
  box-sizing: border-box;
}

:host { --aa-acc:#2b56b0; --aa-acc-bg:#eef1fb; }
.aa-assist-launcher {
  width:52px;height:52px;border:0;border-radius:14px;background:var(--aa-acc);color:#fff;cursor:pointer;
  display:flex;align-items:center;justify-content:center;box-shadow:0 12px 26px rgba(43,86,176,.34);
}
.aa-assist-launcher svg,.aa-assist-close svg,.aa-assist-control svg,.aa-assist-header-badge svg { display:block; }
.aa-assist-launcher:focus-visible,.aa-assist-control:focus-visible,.aa-assist-clear:focus-visible,
.aa-assist-close:focus-visible,.aa-assist-structure-item:focus-visible { outline:3px solid #111827; outline-offset:3px; }
.aa-assist-panel {
  width:min(420px,calc(100vw - 32px));overflow:auto;margin-bottom:10px;
  /* reserve launcher (52px) + gaps + host inset so the panel never clips off-screen;
     dvh override handles the iOS dynamic URL bar where supported */
  max-height:min(720px,calc(100vh - 96px));
  max-height:min(720px,calc(100dvh - 96px));
  background:#fff;color:#111827;border:1px solid #e6e7eb;border-radius:16px;box-shadow:0 20px 50px rgba(17,24,39,.18);
}
:host([data-position^="top"]) .aa-assist-panel { margin-top:10px;margin-bottom:0; }
.aa-assist-header { display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #f0f1f4; }
.aa-assist-header-left { display:flex;align-items:center;gap:10px; }
.aa-assist-header-badge { width:30px;height:30px;border-radius:8px;background:var(--aa-acc);color:#fff;display:flex;align-items:center;justify-content:center; }
.aa-assist-title { margin:0;font-size:16px;line-height:1.25;font-weight:700; }
.aa-assist-close { width:32px;height:32px;border:1px solid #e6e7eb;border-radius:8px;background:#fff;color:#6b7280;cursor:pointer;display:flex;align-items:center;justify-content:center; }
.aa-assist-body { padding:14px 18px 18px; }
.aa-assist-section { margin-top:14px; }
.aa-assist-section:first-of-type { margin-top:2px; }
.aa-assist-section-title { margin:0 0 9px;font-size:11px;letter-spacing:.07em;text-transform:uppercase;font-weight:700;color:#9097a1; }
.aa-assist-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px; }
.aa-assist-control {
  min-height:82px;border:1px solid #e6e7eb;border-radius:12px;background:#fff;color:#111827;cursor:pointer;
  display:flex;flex-direction:column;justify-content:space-between;gap:9px;padding:11px 12px;font:inherit;text-align:left;
}
.aa-assist-control-top { display:flex;align-items:center;justify-content:space-between; }
.aa-assist-control-chip { width:30px;height:30px;border-radius:9px;background:var(--aa-acc-bg);color:var(--aa-acc);display:flex;align-items:center;justify-content:center;flex:none; }
.aa-assist-control-value { font-size:11px;font-weight:600;color:#7c828c;background:#f3f4f6;border-radius:999px;padding:2px 9px; }
.aa-assist-control-label { font-size:13.5px;line-height:1.2;font-weight:600; }
.aa-assist-control[aria-pressed="true"] { border-color:var(--aa-acc);background:#f5f8ff;box-shadow:inset 0 0 0 1px var(--aa-acc); }
.aa-assist-control[aria-pressed="true"] .aa-assist-control-chip { background:var(--aa-acc);color:#fff; }
.aa-assist-control[aria-pressed="true"] .aa-assist-control-value { background:var(--aa-acc);color:#fff; }
.aa-assist-footer { display:flex;justify-content:flex-end;gap:8px;padding:14px 18px;border-top:1px solid #f0f1f4; }
.aa-assist-clear { min-height:38px;border:1px solid #e6e7eb;border-radius:9px;background:#fff;color:#111827;cursor:pointer;font:inherit;font-weight:600;padding:0 14px; }
.aa-assist-structure { margin:10px 18px 0;padding:10px;border:1px solid #e6e7eb;border-radius:12px;background:#fff; }
.aa-assist-structure-group + .aa-assist-structure-group { margin-top:10px; }
.aa-assist-structure-title { margin:0 0 6px;font-size:12px;font-weight:700;color:#374151; }
.aa-assist-structure-list { display:grid;gap:4px; }
.aa-assist-structure-item { min-height:32px;border:1px solid #e6e7eb;border-radius:8px;background:#fff;color:#111827;cursor:pointer;font:inherit;font-size:12px;padding:6px 8px;text-align:left; }
@media (prefers-reduced-motion: reduce) { .aa-assist-launcher,.aa-assist-control,.aa-assist-close { transition:none !important; } }

/* Mobile: the panel takes the whole viewport and scrolls internally.
   A bottom-anchored panel can never fit a tall control grid on a phone,
   so on narrow screens it becomes a full-screen scrollable sheet. */
@media (max-width: 560px) {
  .aa-assist-panel {
    position: fixed;
    inset: 0;
    width: 100vw;
    max-width: 100vw;
    height: 100vh;
    height: 100dvh;
    max-height: 100vh;
    max-height: 100dvh;
    margin: 0;
    border: 0;
    border-radius: 0;
    overflow: auto;
    -webkit-overflow-scrolling: touch;
  }
  .aa-assist-header {
    position: sticky;
    top: 0;
    background: #fff;
    z-index: 1;
  }
}
`;

export const PAGE_EFFECT_CSS = `
body.aa-assist-large-cursor,
body.aa-assist-large-cursor *:not(#aa-assist-root):not(#aa-assist-root *) {
  cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath d='M8 5v35l9-9 6 13 8-4-6-12h13z' fill='%23111827' stroke='%23ffffff' stroke-width='3' stroke-linejoin='round'/%3E%3C/svg%3E") 8 5, auto !important;
}

body.aa-assist-hide-images img:not(#aa-assist-root img),
body.aa-assist-hide-images picture:not(#aa-assist-root picture),
body.aa-assist-hide-images svg:not(#aa-assist-root svg),
body.aa-assist-hide-images video:not(#aa-assist-root video) {
  visibility: hidden !important;
}

body.aa-assist-highlight-links a:not(#aa-assist-root a) {
  outline: 2px solid #4147ea !important;
  outline-offset: 2px !important;
  text-decoration: underline !important;
  text-decoration-thickness: 0.14em !important;
}

body.aa-assist-reading-mode *:not(#aa-assist-root):not(#aa-assist-root *) {
  background: #fff !important;
  color: #111827 !important;
  font-family: Georgia, "Times New Roman", serif !important;
}

body.aa-assist-reading-mode nav:not(#aa-assist-root nav),
body.aa-assist-reading-mode aside:not(#aa-assist-root aside),
body.aa-assist-reading-mode [role="dialog"]:not(#aa-assist-root [role="dialog"]),
body.aa-assist-reading-mode [role="alertdialog"]:not(#aa-assist-root [role="alertdialog"]),
body.aa-assist-reading-mode [class*="popup" i]:not(#aa-assist-root [class*="popup" i]),
body.aa-assist-reading-mode [class*="modal" i]:not(#aa-assist-root [class*="modal" i]),
body.aa-assist-reading-mode [class*="background-video" i]:not(#aa-assist-root [class*="background-video" i]) {
  display: none !important;
}

body.aa-assist-reading-mode main:not(#aa-assist-root main),
body.aa-assist-reading-mode article:not(#aa-assist-root article),
body.aa-assist-reading-mode p:not(#aa-assist-root p),
body.aa-assist-reading-mode li:not(#aa-assist-root li) {
  max-width: 72ch !important;
}

body.aa-assist-highlight-focus *:not(#aa-assist-root):not(#aa-assist-root *):focus {
  outline: 4px solid #f59e0b !important;
  outline-offset: 4px !important;
  box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.28), 0 0 0 12px rgba(17, 24, 39, 0.18) !important;
  background-color: #fffbeb !important;
}

body.aa-assist-dyslexia-font *:not(#aa-assist-root):not(#aa-assist-root *) {
  font-family: Verdana, Tahoma, sans-serif !important;
}

body.aa-assist-readable-font *:not(#aa-assist-root):not(#aa-assist-root *) {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
}

.aa-assist-bionic-prefix {
  font-weight: 800;
}
`;
