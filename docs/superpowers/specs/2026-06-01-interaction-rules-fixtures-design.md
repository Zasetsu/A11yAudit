# Interaction Rules and Fixture Lab Design

## Purpose

A11yAudit currently relies on axe-core for automated DOM, ARIA, HTML, and CSS checks. axe-core is valuable, but it does not perform full browser interaction tests such as tab traversal, keyboard trap detection, focus visibility checks, or clickable-versus-focusable comparison.

This design adds an A11yAudit interaction rule layer powered by Playwright. These rules run after axe-core on the same page and produce normalized findings that can be grouped, persisted, and reported alongside axe findings.

## Scope

Initial interaction rule MVP:

1. `keyboard-unreachable-clickable`
2. `focus-obscured-or-offscreen`
3. `focus-visible-missing`
4. `keyboard-trap-suspected`

The implementation must include file-based HTML fixtures for each rule before rule code is trusted.

## Non-Goals

- Do not replace axe-core.
- Do not claim full WCAG 2.2 conformance from interaction rules.
- Do not perform authenticated or multi-step business-flow testing in the MVP.
- Do not test every possible component state in the first version.
- Do not make interaction rules block scan completion if one rule times out; return a rule-level warning or skip finding instead.

## Fixture Strategy

Use file-based fixtures under `packages/rules/fixtures/interaction/`.

Required files:

- `keyboard-unreachable-clickable.fail.html`
- `keyboard-unreachable-clickable.pass.html`
- `focus-obscured.fail.html`
- `focus-obscured.pass.html`
- `focus-visible.fail.html`
- `focus-visible.pass.html`
- `keyboard-trap.fail.html`
- `keyboard-trap.pass.html`

Add a combined manual/demo lab:

- `packages/rules/fixtures/interaction-lab/index.html`

The lab page should contain all known-bad examples in one page so developers can run a scan and visually inspect/debug the behavior.

## Test Server

Create a small fixture server helper for Playwright tests:

- `packages/rules/src/test-utils/fixture-server.ts`

Responsibilities:

- Serve a fixture directory over local HTTP.
- Return a `baseUrl`.
- Close cleanly after tests.
- Prevent path traversal by normalizing requested paths within the fixture root.

Why HTTP instead of `file://` or `page.setContent()`:

- Browser focus, script, and navigation behavior is closer to real websites.
- Fixtures can include CSS and JS without embedding everything in test strings.
- The same fixture can be opened manually for debugging.

## Rule Interfaces

Add interaction rule modules under:

```text
packages/rules/src/interaction/
  types.ts
  keyboard-unreachable-clickable.ts
  focus-obscured.ts
  focus-visible.ts
  keyboard-trap.ts
  index.ts
```

Shared interface:

```ts
export interface InteractionRuleInput {
  page: Page;
  url: string;
  normalizedUrl: string;
  viewport: Viewport;
}

export interface InteractionRuleFinding {
  ruleId: string;
  title: string;
  severity: Severity;
  certainty: FindingCertainty;
  wcagCriteria: string[];
  description: string;
  recommendation: string;
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
}

export type InteractionRule = (input: InteractionRuleInput) => Promise<InteractionRuleFinding[]>;
```

`auditPage()` maps interaction findings to the existing `ScanFinding` shape, with:

- `source: "custom"`
- `status: "new"`
- `origin: "unknown"` for MVP
- stable fingerprint using normalized URL, viewport, rule ID, WCAG criteria, and selector/snippet signature

## Rule Behavior

### keyboard-unreachable-clickable

Goal: identify controls that can be clicked but cannot be reached by sequential keyboard navigation.

Candidate clickable elements:

- `button`
- `a[href]`
- `input`
- `select`
- `textarea`
- `[role="button"]`
- `[role="link"]`
- `[onclick]`
- elements with pointer cursor and click handler when discoverable

Keyboard reachable elements:

- Elements observed during bounded `Tab` traversal.

Finding condition:

- Element is visible and clickable candidate.
- Element is not disabled.
- Element is not reached during tab traversal.
- Element is not inside an inert/hidden subtree.

Certainty:

- `automatic_violation` for obvious visible clickable controls that are unreachable.

WCAG:

- `2.1.1`

### focus-obscured-or-offscreen

Goal: identify focus stops that are not visible in the viewport or are covered by fixed/sticky UI.

During tab traversal, for each focused element:

- collect bounding box
- verify it intersects viewport
- verify center point is not covered by another element
- verify element is not hidden behind fixed header/footer

Finding condition:

- Focused element has no visible bounding box.
- Focused element is outside viewport after focus.
- `document.elementFromPoint(center)` does not resolve to the focused element or its descendant.

Certainty:

- `needs_manual_verification` initially because sticky UI, overlays, and shadow DOM can create edge cases.

WCAG:

- `2.4.11`

### focus-visible-missing

Goal: identify focusable elements that do not present a visible focus indicator.

During tab traversal:

- capture computed styles before and after focus when practical
- check outline width/style/color
- check box shadow
- check border/color/background changes
- check browser default outline presence

Finding condition:

- Focused element has no detectable focus indicator.

Certainty:

- `needs_manual_verification` for MVP because visual focus detection is heuristic.

WCAG:

- `2.4.7`

### keyboard-trap-suspected

Goal: detect obvious focus loops where users cannot leave a small focus set.

Behavior:

- Traverse with `Tab` up to a bounded number of steps.
- Track focused element identity.
- If focus repeats within a small set and never reaches document escape candidates, mark suspicious.
- Try `Escape` once if a modal-like structure is active.
- Continue traversal after Escape.

Finding condition:

- Focus remains trapped in the same small set after bounded traversal and Escape attempt.

Certainty:

- `needs_manual_verification`

WCAG:

- `2.1.2`

## Bounded Traversal

All interaction rules must be bounded to avoid hanging scans.

Defaults:

- max tab stops per page: `80`
- max rule runtime per page: `5 seconds`
- keyboard trap max repeated cycle size: `6`

If limits are exceeded, return no finding and optionally a rule warning in a later implementation. Do not fail the page scan.

## Evidence

MVP findings should include:

- selector when available
- HTML snippet
- visible text when available

Screenshots are not required in the first interaction rule implementation because the audit package already attaches page-level evidence later. A later version can add element screenshots for focus findings.

## Integration with axe-core

Current flow:

```text
auditPage()
  -> runAxeOnPage()
  -> normalize axe results
```

New flow:

```text
auditPage()
  -> runAxeOnPage()
  -> runInteractionRules()
  -> normalize and merge findings
```

Interaction findings should be appended after axe findings.

## Testing Requirements

For every rule:

- fail fixture produces at least one finding with expected `ruleId`
- pass fixture produces zero findings for that rule
- finding includes WCAG criterion
- finding certainty matches the design
- rule completes within a bounded timeout

For `auditPage()`:

- a fixture containing both axe and interaction issues returns findings from both `source: "axe"` and `source: "custom"`.

## Product Language

Interaction rule findings should be described as technical checks, not full WCAG certification.

Examples:

- "Clickable control is not reachable by keyboard"
- "Focused element appears offscreen or obscured"
- "Focused element has no detectable focus indicator"
- "Potential keyboard trap detected"

Avoid claiming:

- "WCAG 2.1.1 fully failed"
- "Keyboard navigation is completely inaccessible"
- "Site is not WCAG compliant"

## Open Decisions

Resolved:

- Fixtures will be file-based.
- Fixtures will be served over local HTTP in tests.
- Interaction rules will live in `packages/rules`.
- MVP starts with four rules.
- `auditPage()` will merge axe and interaction findings.

Deferred:

- Element screenshots for interaction findings.
- Rule-level warnings in persisted scan output.
- Multi-step flow testing.
- Authenticated scan scripts.
- Shadow DOM-specific focus traversal.
