# Roadmap / Backlog

Living backlog for Audera. Operational items ship directly; product features
go through the brainstorming → spec → plan flow under `docs/superpowers/`.

## Now (operational)

- [x] Cache-bust landing assets (versioned `?v=`, no-cache HTML/CSS/JS).
- [ ] **One-command deploy** — `scripts/deploy.sh`: build core→reporter→…→web
  (with `VITE_A11YAUDIT_API_BASE_URL`) + widget, bump landing asset hashes,
  rsync artifacts, restart `audera`, smoke-check. Removes the manual-deploy
  footguns hit this cycle (forgot restart → blank `/app`; forgot API base →
  signup fails; manual `?v=` hash).
- [ ] Merge `feature/landing-page` to `main` (landing, i18n cleanup, widget
  mobile, deploy docs, em-dash purge).

## Next (product features — each needs a spec)

Deferred from the live "henüz kullanılamıyor / not yet available" labels:

- [ ] **CSV export** — findings + reports. Smallest, frequently requested.
- [ ] **Mark Resolved workflow** — manual resolved override + manual-review
  checklist. The repeat-scan diff already auto-detects `resolved`; this adds
  the human override path.
- [ ] **Scheduled scans** — cron-style recurring audits. Sits on top of the
  existing repeat-scan diff engine.
- [ ] **Invitation emails** — today invites are link/token shared by hand; no
  email provider wired. Add one so onboarding is self-serve.

## Later (large — own epic)

- [ ] **Authenticated scans** — crawl/audit login-gated pages. Critical for
  enterprise customers, but a large plan (session capture, credential safety,
  SSRF boundary review). Explicitly deferred.

## Specs to audit for unbuilt items

- `docs/superpowers/specs/2026-06-02-saas-security-hardening-design.md`
- `docs/superpowers/specs/2026-06-02-saas-member-management-ui-design.md`
