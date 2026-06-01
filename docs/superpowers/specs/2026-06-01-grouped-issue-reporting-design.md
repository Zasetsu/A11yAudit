# Grouped Issue Reporting Design

## Purpose

A11yAudit currently reports each automated violation instance as a finding. That is technically traceable, but it inflates reports on large sites where the same template, header, footer, sidebar, or CMS widget appears across hundreds or thousands of URLs.

The product should distinguish between:

- **Issue**: a grouped accessibility problem that a team can remediate once or in a small number of shared places.
- **Occurrence**: one detected instance of that issue on a specific URL, viewport, selector, and DOM snippet.
- **Affected page**: a unique page where the issue appears.

The default UI and PDF report should be issue-first. Raw occurrence data should remain available for technical drill-down and export.

## Problem Statement

For a site with 5,000 URLs, a global header issue can appear 5,000 times on desktop and 5,000 times on mobile. Reporting that as 10,000 separate findings is misleading for business users and unhelpful for developers.

The report should instead say:

- 1 unique issue
- 5,000 affected pages
- 10,000 occurrences
- likely scope: global header or a URL group/template
- sample URLs and representative evidence

This keeps the report smaller, more actionable, and more honest.

## Product Language

Use these labels consistently:

- **Unique Issues**: grouped problems shown as primary report rows.
- **Total Occurrences**: raw detected instances across pages and viewports.
- **Affected Pages**: unique normalized URLs where the issue appears.
- **Likely Scope**: inferred repeated scope, such as `global`, `URL group /haberler/*`, or `single page`.
- **Component Area**: inferred DOM area, such as `header`, `footer`, `nav`, `aside`, `main`, `form`, or `unknown`.
- **CMS Hint**: optional enrichment, such as `Elementor widget button`, `Elementor nav menu`, `WordPress single post`, or `none`.
- **Confidence**: `high`, `medium`, or `low`, used for inferred labels only.

Avoid overclaiming. Do not say "News detail template" unless a reliable CMS signal exists. Prefer "URL group /haberler/*" plus supporting hints.

## Data Model

### Occurrence

An occurrence is the raw result currently represented by `ScanFinding`.

Fields:

- run ID
- project ID
- page URL
- normalized URL
- viewport
- rule ID
- WCAG criteria
- severity
- selector
- HTML snippet
- visible text when available
- evidence artifacts
- occurrence fingerprint

The occurrence fingerprint may continue to include normalized URL and viewport because it represents a precise technical instance.

### Issue

An issue groups occurrences that should be remediated together.

Fields:

- issue ID
- run ID
- project ID
- issue key
- title
- severity
- rule ID
- WCAG criteria
- certainty
- source
- likely scope
- component area
- CMS hint
- confidence
- affected page count
- occurrence count
- viewport summary: `desktop`, `mobile`, or `desktop,mobile`
- representative URL
- representative selector
- representative HTML snippet
- recommendation
- sample URLs, capped for UI and PDF

### Issue Key

The first implementation should compute an issue key from:

- rule ID
- sorted WCAG criteria
- normalized element signature
- inferred component area
- inferred URL scope group
- CMS hint when available

The issue key should not include the full normalized URL. Otherwise repeated template issues remain page-level findings.

## Inference Rules

### URL Scope Inference

Infer URL groups from normalized paths.

Examples:

- `/haberler/slug-a` and `/haberler/slug-b` -> `/haberler/*`
- `/blog/2026/title` and `/blog/2025/title` -> `/blog/*`
- `/urunler/category/item` -> `/urunler/*`

Rules:

- Root path remains `/`.
- If many URLs share the same first path segment, group by `/<segment>/*`.
- If a path group has only one URL, treat it as `single page`.
- Scope confidence increases when the same issue appears on a high percentage of URLs in the group.

Initial confidence:

- `high`: issue appears on at least 80% of pages in a URL group with at least 5 pages.
- `medium`: issue appears on at least 40% of pages in a URL group with at least 3 pages.
- `low`: otherwise.

### Component Area Inference

Infer from selector and HTML snippet.

Priority:

1. `header`
2. `footer`
3. `nav`
4. `aside`
5. `form`
6. `main`
7. `unknown`

Signals:

- selector includes `header`, `footer`, `nav`, `aside`, `main`, or `form`
- HTML snippet includes matching landmark tags
- ARIA roles when available in the snippet

Do not infer more specific labels unless CMS hints support them.

### CMS and Elementor Hints

CMS hints enrich the issue, but core grouping must work without them.

Elementor signals:

- `.elementor-widget-button` -> `Elementor widget button`
- `.elementor-widget-nav-menu` -> `Elementor nav menu`
- `.elementor-widget-form` -> `Elementor form`
- `.elementor-location-header` -> component area `header`
- `.elementor-location-footer` -> component area `footer`

WordPress signals:

- `single-post` -> `WordPress single post`
- `archive` or `category` -> `WordPress archive/category`
- `post-template` -> `WordPress post template`

If multiple hints exist, choose the most specific widget hint for `cmsHint` and keep component area separately.

## UI Design

### Dashboard Metrics

Replace finding-first metrics with:

- Unique Issues
- Critical Issues
- Affected Pages
- Total Occurrences

The old `findingsTotal` should either be renamed to `occurrencesTotal` or mapped carefully in the API response.

### Issue List

Default list rows should represent grouped issues.

Columns:

- Severity
- Issue
- WCAG
- Likely scope
- Component area
- CMS hint
- Affected pages
- Occurrences
- Viewports

Rows should be sorted by:

1. severity rank
2. affected page count
3. occurrence count

### Issue Detail

Issue detail should show:

- summary
- recommendation
- likely scope with confidence
- affected pages count
- occurrence count
- sample URLs
- representative selector and snippet
- evidence artifacts
- optional occurrence table with pagination

Raw occurrence tables should not be the default view.

## PDF Report Design

PDF should be issue-first and compact.

Sections:

1. Executive summary
2. Scope summary
3. Severity summary by unique issues
4. Occurrence totals
5. Top recurring issues
6. Grouped issue table
7. Sample evidence appendix
8. Manual review and legal disclaimer

Main issue table columns:

- Issue
- Severity
- WCAG
- Likely scope
- Component area
- CMS hint
- Affected pages
- Occurrences
- Sample URLs
- Recommendation

PDF should not print every occurrence. It should cap issue rows and sample evidence rows, and clearly state when data is summarized.

## API Design

Add issue-first endpoints while keeping raw occurrence access.

Endpoints:

- `GET /api/issues`
- `GET /api/issues/:id`
- `GET /api/issues/:id/occurrences`
- `GET /api/scans/:id/issues`
- `GET /api/scans/:id/occurrences`

Existing findings endpoints can remain temporarily, but UI should migrate to issue endpoints.

## Persistence Strategy

Preferred schema:

- `issues`
- `issue_occurrences`

`issues` stores aggregate fields and representative data.

`issue_occurrences` stores raw URL-level instances.

This avoids storing only aggregate data and preserves technical traceability.

## Report Pipeline Reliability

The scan pipeline should persist occurrence data before PDF generation. A PDF rendering failure must not discard completed audit results.

Target flow:

1. crawl URLs
2. audit pages
3. persist occurrences incrementally or before report rendering
4. aggregate issues
5. persist issues
6. generate HTML report
7. generate PDF report
8. mark scan completed if audit data persisted and at least one report is available

If PDF fails:

- keep scan data
- keep HTML report if generated
- mark report status as failed or partial
- expose retry report generation

Do not mark the whole scan failed after successful audit persistence unless no usable scan data exists.

## Testing

Add tests for:

- repeated header issue across many URLs becomes one issue
- same issue across desktop and mobile becomes one issue with viewport summary
- `/haberler/*` URL scope inference
- component area inference from `aside`, `header`, and `footer`
- Elementor widget hint inference
- affected page count vs occurrence count
- PDF does not print every occurrence
- PDF failure does not delete or block persisted audit data

## Migration Notes

Existing failed scans without persisted findings cannot be reconstructed reliably from artifacts alone because snippet and screenshot artifact keys are hashed and do not contain full metadata.

Existing completed scans can be migrated by reading current findings rows as occurrences and aggregating issues from them.

## Open Decisions

Resolved for initial implementation:

- Default UI and PDF should show grouped issues, not URL-level findings.
- Desktop and mobile occurrences should group into one issue when rule, signature, scope, and component area match.
- Elementor support should be enrichment, not a hard dependency.
- URL pattern inference should start with first path segment grouping.

Deferred:

- CSV/JSON occurrence export format.
- Advanced path clustering beyond first segment.
- CMS-specific admin links or source-map style remediation hints.
