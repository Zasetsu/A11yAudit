# Grouped Issue Reporting Review Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix validated grouped issue reporting regressions: confidence calculation, scoped issue loading, PDF fallback visibility, issue-first project summaries, and malformed issue row handling.

**Architecture:** Keep grouped issues as the primary product model. Confidence will use URL-group coverage from audited pages. Web UI will request scoped issue data instead of loading all historical issues. Existing DB schema remains unchanged.

**Tech Stack:** TypeScript monorepo, Vitest, React, Fastify, Drizzle SQLite, pnpm.

---

## Task 1: Spec-Based Confidence

**Files:**
- Modify: `packages/core/src/issues.ts`
- Modify: `packages/core/src/issues.test.ts`
- Modify: `packages/reporter/src/report-model.ts`
- Modify: `apps/server/src/app.ts`
- Test: `packages/reporter/src/html-template.test.ts`

- [ ] Add optional aggregation input: `aggregateScanIssues(findings, { auditedPages })`.
- [ ] Build URL-group denominators from audited pages:
  - same origin only
  - normalized URL without hash
  - grouped by first path segment
- [ ] Keep `likelyScope` based on affected pages for the issue itself.
- [ ] Compute confidence from group coverage:
  - `high`: affected pages / audited group pages >= 0.8 and audited group pages >= 5
  - `medium`: affected pages / audited group pages >= 0.4 and audited group pages >= 3
  - `low`: otherwise
- [ ] Fall back to unique finding URLs when `auditedPages` is not supplied.
- [ ] Pass `input.pages` from `buildAuditReportModel`.
- [ ] Pass `result.pages` from server persistence.
- [ ] Update tests for:
  - 2 of 3 `/haberler/*` pages => `medium`
  - 4 of 5 `/haberler/*` pages => `high`
  - 2 of 2 pages => `low`
  - unrelated findings do not inflate scope
  - cross-origin pages do not share denominators

## Task 2: Scoped Issue API Loading

**Files:**
- Modify: `apps/web/src/app.tsx`
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/api/client.test.ts`
- Modify: `apps/server/src/routes/issues.ts`
- Modify: `apps/server/src/app.test.ts`

- [ ] Compute selected project before issue query construction.
- [ ] Find latest scan for selected project.
- [ ] Call `fetchIssues({ projectId, scanRunId })` when a scan exists.
- [ ] Call `fetchIssues({ projectId })` when no scan exists.
- [ ] Change React Query key to include `projectId` and `scanRunId`.
- [ ] Make `/api/issues` reject unfiltered requests with `400`.
- [ ] Keep filtered server responses unchanged.
- [ ] Add tests proving:
  - unfiltered `/api/issues` returns `400`
  - project filter works
  - project + scan filter works
  - web client builds expected query strings

## Task 3: PDF Fallback Visibility

**Files:**
- Modify: `apps/web/src/pages/scan-runs.tsx`
- Modify: `apps/web/src/pages/scan-runs.test.ts`
- Modify: `apps/web/src/pages/reports.tsx`

- [ ] Show `scan.errorMessage` for completed scans as a warning.
- [ ] Keep failed scans styled as errors.
- [ ] Add helper functions for warning/error message presentation.
- [ ] Allow ready HTML reports to download through `getReportDownloadUrl(report.id)`.
- [ ] Change report button title from PDF-only to format-aware copy.
- [ ] Keep non-ready reports disabled.
- [ ] Add tests for:
  - failed progress label remains failed
  - completed scan with report warning exposes warning text
  - ready HTML report is downloadable

## Task 4: Project Summary Counts

**Files:**
- Modify: `apps/server/src/routes/projects.ts`
- Modify: `apps/server/src/app.test.ts`
- Modify: `apps/web/src/pages/projects.tsx`

- [ ] Change project summary count to grouped issue count from the latest completed scan.
- [ ] Keep response field name `openFindings` for compatibility.
- [ ] Update UI label to `unique issues`.
- [ ] Update tests so project listing expects grouped issue count, not raw finding count.

## Task 5: Malformed Issue Row Guard

**Files:**
- Modify: `apps/web/src/api/client.ts`
- Modify: `apps/web/src/api/client.test.ts`

- [ ] Add `isServerIssue(row): row is ServerIssue`.
- [ ] Validate required fields:
  - ids and key strings
  - title, severity, source, certainty
  - rule ID and WCAG criteria
  - scope/component/confidence strings
  - affected page and occurrence numbers
  - representative URL and created date
- [ ] Change `fetchIssues` to `result.data.filter(isServerIssue).map(mapIssue)`.
- [ ] Update malformed API row test to expect `[]`.

## Verification

- [ ] Run targeted reporter test:
  - `rtk npm exec pnpm@9 -- test packages/reporter/src/html-template.test.ts`
- [ ] Run targeted core tests:
  - `rtk npm exec pnpm@9 -- test packages/core/src/issues.test.ts`
- [ ] Run server tests:
  - `rtk npm exec pnpm@9 -- test apps/server/src/app.test.ts`
- [ ] Run web client/page tests:
  - `rtk npm exec pnpm@9 -- test apps/web/src/api/client.test.ts apps/web/src/pages/scan-runs.test.ts`
- [ ] Run full test suite:
  - `rtk npm exec pnpm@9 -- test`
- [ ] Run typecheck:
  - `rtk npm exec pnpm@9 -- typecheck`
- [ ] Run build:
  - `rtk npm exec pnpm@9 -- build`

## Assumptions

- Confidence policy is spec-based.
- No DB migration is required.
- No UI pagination is added in this pass.
- `openFindings` remains as a compatibility field, but UI copy becomes issue-first.
- HTML report fallback is a valid downloadable report artifact.
