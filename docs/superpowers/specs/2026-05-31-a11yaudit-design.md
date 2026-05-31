# A11yAudit Design Spec

Date: 2026-05-31

## Product Summary

A11yAudit is an Apache-2.0 licensed, open-source, self-hosted WCAG 2.2 technical accessibility audit and PDF reporting tool.

The product audits public web pages through a real browser, captures technical evidence, groups findings, compares repeat scans, and generates a PDF report that serves both executive and engineering audiences.

A11yAudit is not a certification tool. It provides automated technical accessibility audit results and identifies areas that require manual review.

## Product Language

All product-facing material is English-only:

- Web UI copy
- CLI output
- PDF reports
- Documentation
- Rule descriptions
- Examples
- Issue templates
- Code comments

No Turkish product copy is included in the MVP.

## License

A11yAudit uses the Apache-2.0 license.

This favors broad adoption by companies, agencies, institutions, and individual developers. The project accepts that permissive licensing allows commercial reuse, including closed hosted offerings, in exchange for lower adoption friction.

## Target Users

Primary users:

- Developers
- QA engineers
- Accessibility specialists
- Web agencies
- Public institutions
- Enterprises operating high-traffic public websites

The MVP is designed as a self-hosted tool, not a hosted SaaS product.

## Core Scope

The MVP supports:

- Public website audits
- Same-domain crawling
- Specific URL list audits
- Single URL audits
- Desktop and mobile viewport testing
- WCAG 2.2-oriented automated checks
- axe-core integration
- A11yAudit custom rules
- Evidence collection
- PDF report generation
- Repeat scan comparison
- Local-first storage and database defaults

The MVP does not support:

- Authenticated scans
- Billing
- Subscriptions
- Multi-tenant organization management
- Jira or GitHub issue integration
- Mobile application audits
- Legal certification claims

## User Flow

1. The user opens the Web UI or CLI.
2. The user creates a project or provides a URL directly.
3. The user chooses a scan mode:
   - Single URL
   - URL list
   - Same-domain crawl
4. The user configures crawl limits and viewports.
5. A scan job starts.
6. The crawler discovers public pages within the configured scope.
7. The audit runner opens each page in Playwright Chromium.
8. Each page is audited in desktop and mobile viewports.
9. axe-core and custom rules produce normalized findings.
10. Evidence is captured for each finding.
11. Findings are grouped and compared with the previous scan.
12. A PDF report is generated.
13. The user reviews findings in the Web UI or downloads the PDF.

## Application Structure

The repository is a TypeScript monorepo:

```text
apps/web
apps/server
apps/cli

packages/core
packages/crawler
packages/rules
packages/reporter
packages/storage
```

### apps/web

React Web UI for project management, scan configuration, scan progress, findings exploration, and report downloads.

Recommended stack:

- Vite
- React
- TypeScript
- TanStack Query
- React Router or TanStack Router
- Lucide icons

### apps/server

Self-hosted local API and scan orchestration service.

Responsibilities:

- Project CRUD
- Scan run creation
- Scan progress state
- Finding queries
- Report download endpoints
- Local settings
- Artifact serving
- Job orchestration

### apps/cli

Command-line interface for direct audit usage and automation.

Example:

```bash
a11y-audit scan https://example.com --desktop --mobile --pdf
```

The CLI should use the same shared packages as the Web UI server.

### packages/core

Shared domain model and configuration.

Responsibilities:

- Scan configuration types
- Viewport definitions
- Finding model
- Severity model
- WCAG 2.2 criterion metadata
- Report model types
- Diff status model

### packages/crawler

URL discovery and page traversal.

Responsibilities:

- Same-domain link extraction
- URL normalization
- robots.txt handling
- crawl depth limits
- page count limits
- duplicate URL detection
- static asset exclusion
- redirect validation

### packages/rules

Accessibility rule execution.

Responsibilities:

- axe-core execution
- custom rule execution
- rule metadata
- WCAG mapping
- certainty classification
- normalized finding output

### packages/reporter

Report model generation and PDF rendering.

Responsibilities:

- executive summary generation
- technical findings section
- evidence appendix
- manual review checklist
- HTML report template
- Playwright PDF rendering

### packages/storage

Artifact storage abstraction.

Responsibilities:

- local filesystem storage adapter
- future S3-compatible adapter
- artifact key generation
- artifact metadata
- report and screenshot storage

The MVP defaults to local filesystem storage. S3-compatible storage is an optional future adapter, not a required runtime dependency.

## UI Pages

## Reference UI Prototype

A reference UI prototype exists at:

```text
/Users/zasetsu/Downloads/A11yAudit
```

The implementation plan should treat this prototype as the visual and interaction baseline for the Web UI:

- shell layout
- navigation
- top bar
- dashboard density
- findings explorer
- finding detail evidence layout
- scan run progress view
- reports page
- settings sections
- light and dark theme tokens

Prototype details that are not MVP product commitments:

- scheduled scan triggers in sample data
- CSV export action
- manual "Mark Resolved" action
- fake version numbers
- temporary GitHub URLs

The MVP implementation may include disabled or hidden UI affordances for these items only if they do not imply shipped support.

### Overview

Shows current project health:

- latest scan status
- last scanned date
- accessibility score
- total findings
- severity distribution
- desktop vs mobile split
- new, ongoing, resolved, and changed findings
- WCAG 2.2 breakdown
- top affected URLs
- recurring issues
- recent scan runs
- latest PDF download

### Projects

Manages audited websites locally:

- project list
- project creation
- base URL
- default crawl limit
- default viewports
- latest score
- latest report

No billing, subscription, or organization-management UI exists in the MVP.

### New Scan

Configures an audit:

- base URL
- URL list
- scan mode
- max pages
- max depth
- robots.txt setting
- include patterns
- exclude patterns
- desktop viewport
- mobile viewport
- evidence settings
- safety settings

The page includes a clear disclaimer:

```text
A11yAudit performs technical accessibility audits. It does not certify legal compliance.
```

### Scan Run Detail

Shows live or completed scan state:

- queued
- crawling
- auditing
- generating report
- completed
- failed

It also shows:

- discovered pages
- audited pages
- current URL
- failed URLs
- desktop and mobile progress
- runtime
- worker logs
- live finding summary
- abort scan action

### Findings Explorer

Technical triage table with filters:

- severity
- WCAG criterion
- viewport
- status
- source
- URL
- manual review requirement

Findings can be grouped by probable root cause:

- component
- template
- content
- third-party widget
- unknown

### Finding Detail

Shows evidence for a single issue:

- title
- severity
- WCAG criterion
- status
- viewport
- explanation
- user impact
- suggested fix
- screenshot
- element crop
- CSS selector
- HTML snippet
- visible text
- affected URL
- browser viewport
- instances table
- previous scan comparison

Each finding is classified as one of:

- automatic violation
- needs manual verification
- not automatically testable

### Reports

Lists generated PDF reports:

- report name
- project
- scan date
- pages audited
- score
- findings count
- file size
- status
- download action
- summary preview

### Settings

Configures local instance behavior:

- storage adapter
- artifact retention
- max concurrent scans
- per-page timeout
- browser launch options
- PDF branding name
- screenshot inclusion
- HTML snippet inclusion
- private network blocking
- metadata IP blocking
- domain allowlist
- app version
- Apache-2.0 license reference
- GitHub repository link

## Scan Modes

### Single URL

Audits only one URL.

### URL List

Audits an explicit list of URLs.

### Same-domain Crawl

Starts from a base URL and discovers links within the same domain.

External domains are blocked by default. Subdomains are excluded by default unless explicitly included.

## Viewports

Every audited page runs through both default viewports:

```text
Desktop: 1440x900
Mobile: 390x844
```

Each finding is tagged as:

- desktop only
- mobile only
- desktop and mobile

## Crawler Defaults

Default crawl settings:

```text
Max pages: 250
Max depth: 3
Respect robots.txt: true
Page timeout: 30s
Navigation timeout: 45s
Max redirects: 5
Max HTML size: 5 MB
External domains: blocked
Private IPs: blocked
Localhost: blocked
Metadata IPs: blocked
Downloads: blocked
```

URL normalization:

- remove hash fragments
- normalize trailing slashes
- remove tracking parameters such as `utm_*`, `fbclid`, `gclid`, and `yclid`
- exclude `mailto:`, `tel:`, and `javascript:` links
- exclude common static assets
- avoid duplicate query parameter combinations

Static asset examples:

- `.pdf`
- `.zip`
- `.jpg`
- `.png`
- `.mp4`
- `.docx`
- `.xlsx`

## Rule Engine

The MVP has two rule sources.

### axe-core

axe-core provides the main automated accessibility checks.

Each axe result is normalized into the A11yAudit finding model:

- rule id
- impact
- WCAG tags
- description
- help URL
- affected nodes
- evidence metadata

### Custom Rules

A11yAudit custom rules cover high-value checks and warnings not represented well enough by raw axe output.

Initial custom rule candidates:

- suspicious image alt text
- weak link text
- heading outline warnings
- repeated landmark problems
- mobile-only icon buttons without accessible names
- hidden label and visible label mismatch
- focusable element with zero visible size
- missing skip link warning
- document title quality warning
- simple language mismatch warning

Each custom rule has:

```text
id
title
description
wcagCriteria
severity
certainty
appliesTo
checkFunction
recommendation
```

Certainty values:

- automatic_violation
- needs_manual_verification
- not_automatically_testable

Custom rules must be conservative to avoid excessive false positives.

## Evidence Model

Each finding instance can store:

- URL
- normalized URL
- viewport
- CSS selector
- HTML snippet
- visible text
- screenshot artifact
- element crop artifact
- rule source
- WCAG criterion
- severity
- certainty
- recommendation

Evidence artifacts are stored outside the database through the storage adapter.

## Finding Identity and Diff

Repeat scans compare findings through a stable identity model.

Identity inputs:

- normalized URL
- viewport
- rule id
- WCAG criterion
- element signature

Element signature may include:

- tag name
- accessible name
- role
- stable attributes such as `id`, `name`, `aria-label`, `href`, and `src`
- nearby text
- DOM path hash
- landmark or component context

Diff statuses:

- new
- ongoing
- resolved
- changed

`changed` means the finding appears to represent the same underlying issue, but its selector or evidence changed between scans.

Ignore and waiver workflows are out of scope for the MVP, but the data model should preserve a clear extension path for them.

## Report Generation

Report pipeline:

```text
scan result JSON
  -> report model
  -> HTML report template
  -> Playwright PDF render
  -> storage artifact
```

HTML templates are used because they support preview and PDF generation from the same layout.

PDF sections:

1. Cover
2. Executive Summary
3. Scan Scope
4. Score and Severity Distribution
5. WCAG 2.2 Breakdown
6. Desktop vs Mobile Findings
7. New, Ongoing, Resolved, and Changed Findings
8. Top Affected URLs
9. Recurring Issues
10. Technical Findings
11. Evidence Appendix
12. Manual Review Checklist
13. Technical Audit Disclaimer

Large report behavior:

- executive summary remains short
- technical findings are grouped
- each finding shows at most three evidence examples by default
- remaining instances are listed in tables
- large scans may switch to summary plus appendix mode

Report disclaimer:

```text
A11yAudit provides automated technical accessibility audit results.
It does not certify legal compliance. Some WCAG 2.2 success criteria
require manual review and human judgment.
```

## Scoring

The score is designed for prioritization, not certification.

Scoring principles:

- critical findings have the highest weight
- serious findings have high weight
- moderate and minor findings have lower weight
- repeated instances are counted, but recurring root causes are grouped
- not-automatically-testable criteria do not reduce the score
- manual review items appear in a separate checklist
- desktop-only and mobile-only findings remain visible

The UI and report must avoid implying legal compliance certification.

## Runtime Profiles

### Quickstart

Default local setup:

```text
SQLite
Local filesystem storage
In-process job runner
```

This is optimized for fast adoption.

### Advanced Self-hosted

Optional advanced profile:

```text
PostgreSQL
Redis queue
Separate worker process
Local or S3-compatible storage
```

This is optimized for larger scans and institutional deployments.

## Security Requirements

A11yAudit opens URLs supplied by users, so scan isolation and network safety are core requirements.

The MVP must include:

- private IP blocking
- localhost blocking
- metadata IP blocking
- redirect target validation
- maximum redirect count
- request timeout
- navigation timeout
- download blocking
- maximum page count
- maximum crawl depth
- maximum response size
- worker isolation
- browser permission denial
- conservative browser launch configuration

SSRF protection must be applied before navigation and after every redirect.

## Accessibility Requirements for A11yAudit UI

The product UI must itself follow accessibility best practices:

- keyboard navigation
- visible focus states
- semantic headings
- properly labeled form controls
- high contrast
- non-color-only status indicators
- accessible table headers
- accessible button names
- modal focus trapping
- focus restoration after modal close

## Open Source Project Requirements

The repository should include:

- Apache-2.0 license file
- README
- quickstart guide
- Docker Compose setup
- example environment file
- contribution guide
- security policy
- issue templates
- rule authoring guide
- roadmap
- sample report

## Design Decisions

Key accepted decisions:

- A11yAudit is open-source and self-hosted.
- The project is not a SaaS product in the MVP.
- The product language is English.
- The conversation and planning language with the project owner may be Turkish.
- The core architecture is a TypeScript monorepo.
- The Web UI uses React.
- The audit engine uses Playwright and axe-core.
- The report format is PDF-first.
- The MVP uses local-first defaults.
- S3-compatible storage is supported through abstraction, not required.
- Desktop and mobile audits are both included.
- Repeat scan diffing is included.
- Authenticated scans are out of scope.

## Open Questions for Implementation Planning

- Exact package manager: pnpm, npm, or yarn.
- Exact server framework: Fastify or another Node framework.
- Exact database library and migration tool.
- Exact UI component strategy.
- Exact chart library.
- Exact custom rule count for the first implementation phase.
- Exact PDF visual design system.
- Exact Docker Compose profiles.
