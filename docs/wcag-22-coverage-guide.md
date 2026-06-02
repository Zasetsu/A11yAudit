# WCAG 2.2 Coverage Guide

Last verified: 2026-06-02

This document maps the full WCAG 2.2 success criterion set to the current A11yAudit automation surface.

Sources:

- W3C WCAG 2.2 Recommendation: https://www.w3.org/TR/WCAG22/
- W3C Understanding WCAG 2.2: https://www.w3.org/WAI/WCAG22/Understanding/
- Local axe-core metadata: `axe-core` 4.11.4 from the workspace lockfile.
- Current A11yAudit axe configuration: `packages/rules/src/axe-runner.ts`
- Current A11yAudit Playwright interaction rules: `packages/rules/src/interaction/`

## Automation Boundary

WCAG conformance cannot be fully proven by automation. A11yAudit should describe results as technical accessibility findings, not certification.

The table below separates:

- what the installed axe-core engine can detect in the current A11yAudit configuration;
- what A11yAudit currently detects with custom Playwright interaction rules;
- what remains manual, interpretive, content-dependent, media-dependent, or journey-dependent.

## Legend

### Axe-core Column

- `Yes`: A mapped axe-core rule is enabled by the current A11yAudit `runOnly` tags.
- `Partial`: axe-core can detect technical failures for part of the criterion, but cannot prove the full criterion.
- `Available/off`: axe-core has a mapped rule, but it is not enabled by the current A11yAudit tag configuration, usually because it is AAA or obsolete.
- `No`: no mapped axe-core rule was found in the installed axe-core metadata.

Current A11yAudit axe tags:

```ts
["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
```

### Playwright Column

- `Supported`: A custom Playwright interaction rule currently maps to this criterion.
- `Heuristic`: A custom Playwright rule currently provides a technical signal, but still needs manual confirmation.
- `Candidate`: A future Playwright rule could cover part of the criterion with deterministic fixtures.
- `No`: no current Playwright coverage.

Current Playwright custom rules:

| Rule ID | WCAG | Status |
| --- | --- | --- |
| `keyboard-unreachable-clickable` | 2.1.1 | Supported technical signal |
| `keyboard-trap-suspected` | 2.1.2 | Heuristic technical signal |
| `focus-visible-missing` | 2.4.7 | Heuristic technical signal |
| `focus-obscured-or-offscreen` | 2.4.11 | Heuristic technical signal |

## Coverage Summary

| Category | Count | Notes |
| --- | ---: | --- |
| WCAG 2.2 active success criteria | 86 | Includes A, AA, and AAA. |
| Removed criterion listed for compatibility | 1 | 4.1.1 Parsing is obsolete and removed in WCAG 2.2. |
| Current Playwright-supported criteria | 4 | 2.1.1, 2.1.2, 2.4.7, 2.4.11. |
| Current axe-core mapped criteria | 24 | Some are partial technical checks only. |
| Criteria that require manual or scenario review | Most | Especially media, content meaning, labels, instructions, errors, authentication, and complete processes. |

## WCAG 2.2 Coverage Matrix

| SC | Level | Success Criterion | axe-core | Playwright custom | Automation status | Guide note |
| --- | --- | --- | --- | --- | --- | --- |
| 1.1.1 | A | Non-text Content | Partial | No | Partial automated | Detects many missing technical alternatives, but quality, equivalence, decorative intent, CAPTCHA alternatives, and media alternatives need manual review. |
| 1.2.1 | A | Audio-only and Video-only (Prerecorded) | Partial | No | Mostly manual | axe can flag some missing captions/media metadata, but equivalent transcripts and audio/video alternatives require media/content review. |
| 1.2.2 | A | Captions (Prerecorded) | Partial | No | Mostly manual | Caption existence may be technically signaled, but caption completeness and synchronization require manual/media review. |
| 1.2.3 | A | Audio Description or Media Alternative (Prerecorded) | No | No | Manual | Requires reviewing prerecorded video content and alternatives. |
| 1.2.4 | AA | Captions (Live) | No | No | Manual | Live captions require live media workflow review. |
| 1.2.5 | AA | Audio Description (Prerecorded) | No | No | Manual | Requires reviewing video content and audio description availability. |
| 1.2.6 | AAA | Sign Language (Prerecorded) | No | No | Manual | Requires media/content review. |
| 1.2.7 | AAA | Extended Audio Description (Prerecorded) | No | No | Manual | Requires media/content review. |
| 1.2.8 | AAA | Media Alternative (Prerecorded) | No | No | Manual | Requires complete media alternative review. |
| 1.2.9 | AAA | Audio-only (Live) | No | No | Manual | Requires live media workflow review. |
| 1.3.1 | A | Info and Relationships | Partial | No | Partial automated | axe detects many structural failures in lists, tables, ARIA relationships, and required parents/children, but visual relationships and semantic correctness remain interpretive. |
| 1.3.2 | A | Meaningful Sequence | No | Candidate | Manual/heuristic candidate | DOM order versus visual/reading order can be sampled with Playwright, but meaningful sequence needs human judgment. |
| 1.3.3 | A | Sensory Characteristics | No | No | Manual | Requires interpreting whether instructions depend only on shape, color, size, visual location, orientation, or sound. |
| 1.3.4 | AA | Orientation | Partial | Candidate | Partial automated | axe can detect CSS orientation locks. Playwright could verify portrait/landscape behavior. Legitimate exceptions remain manual. |
| 1.3.5 | AA | Identify Input Purpose | Partial | No | Partial automated | axe validates supported `autocomplete` values, but whether the correct purpose was chosen needs review. |
| 1.3.6 | AAA | Identify Purpose | No | No | Manual | Requires semantic purpose taxonomy and content judgment. |
| 1.4.1 | A | Use of Color | Partial | Candidate | Mostly manual | axe can detect some link color distinction issues. Broader color-only communication needs visual/content review. |
| 1.4.2 | A | Audio Control | Partial | Candidate | Partial automated | axe detects autoplay audio patterns. Playwright could inspect playback controls, but actual audio behavior may need manual review. |
| 1.4.3 | AA | Contrast (Minimum) | Partial | No | Partial automated | axe detects many text contrast failures. Images of text, gradients, overlays, disabled states, and dynamic states may need review. |
| 1.4.4 | AA | Resize Text | Partial | Candidate | Partial automated | axe detects viewport scaling blockers such as restrictive meta viewport. Full 200 percent resize behavior requires visual regression checks. |
| 1.4.5 | AA | Images of Text | No | No | Manual | Requires judging whether text is rendered as an image and whether exceptions apply. |
| 1.4.6 | AAA | Contrast (Enhanced) | Available/off | No | Optional automated if enabled | axe has `color-contrast-enhanced`, but current A11yAudit tags do not enable AAA checks. |
| 1.4.7 | AAA | Low or No Background Audio | No | No | Manual | Requires audio content analysis. |
| 1.4.8 | AAA | Visual Presentation | No | Candidate | Mostly manual | Some CSS checks are possible, but user-controlled presentation and readability are interpretive. |
| 1.4.9 | AAA | Images of Text (No Exception) | No | No | Manual | Requires content review. |
| 1.4.10 | AA | Reflow | No | Candidate | Candidate | Playwright could test 320 CSS px and 400 percent zoom/reflow behavior. Not currently implemented. |
| 1.4.11 | AA | Non-text Contrast | No | Candidate | Candidate/manual | Playwright visual analysis could sample UI component boundaries, focus indicators, icons, and graphical objects, but interpretation is hard. |
| 1.4.12 | AA | Text Spacing | Partial | Candidate | Partial automated | axe detects inline style blockers in some cases. Full text-spacing override testing needs Playwright layout checks. |
| 1.4.13 | AA | Content on Hover or Focus | No | Candidate | Candidate/manual | Playwright can trigger hover/focus and check dismissibility/persistence, but intent and edge cases need review. |
| 2.1.1 | A | Keyboard | Partial | Supported | Partial automated | axe detects some focusability issues. A11yAudit also checks visible clickable controls not reached by Tab. Complete keyboard operability still needs manual path testing. |
| 2.1.2 | A | No Keyboard Trap | No | Heuristic | Heuristic/manual | A11yAudit detects simple repeated focus loops and Escape recovery. Complex traps and application flows need manual review. |
| 2.1.3 | AAA | Keyboard (No Exception) | Partial | Supported | Partial automated | Current 2.1.1 Playwright signal also helps here, but full no-exception keyboard operation needs manual testing. |
| 2.1.4 | A | Character Key Shortcuts | No | Candidate | Manual/candidate | Could detect global key listeners and single-character shortcuts, but determining alternatives and exceptions needs review. |
| 2.2.1 | A | Timing Adjustable | Partial | Candidate | Partial/manual | axe can detect meta refresh. Session time limits, warnings, extension controls, and exceptions require journey review. |
| 2.2.2 | A | Pause, Stop, Hide | Partial | Candidate | Partial/manual | axe detects `blink` and `marquee`. Moving/auto-updating content and controls require interaction review. |
| 2.2.3 | AAA | No Timing | No | Candidate | Manual/candidate | Requires identifying time limits across flows and exceptions. |
| 2.2.4 | AAA | Interruptions | Available/off | Candidate | Manual/candidate | axe has an AAA meta-refresh no-exception rule, but broader interruption control is journey-dependent. |
| 2.2.5 | AAA | Re-authenticating | No | No | Manual | Requires authenticated workflow testing. |
| 2.2.6 | AAA | Timeouts | No | No | Manual | Requires session timeout disclosure and workflow review. |
| 2.3.1 | A | Three Flashes or Below Threshold | No | Candidate | Manual/specialized | Requires flash analysis over time. Could be future video/frame analysis, but not currently implemented. |
| 2.3.2 | AAA | Three Flashes | No | Candidate | Manual/specialized | Same as 2.3.1 with stricter threshold. |
| 2.3.3 | AAA | Animation from Interactions | No | Candidate | Candidate/manual | Playwright could trigger interactions and detect motion, but determining disable controls and exceptions needs review. |
| 2.4.1 | A | Bypass Blocks | Partial | Candidate | Partial automated | axe detects some missing bypass mechanisms. Usability and effectiveness require keyboard/manual verification. |
| 2.4.2 | A | Page Titled | Yes | No | Automated technical | axe checks document title existence/quality basics. Whether a title is truly descriptive may still need review. |
| 2.4.3 | A | Focus Order | No | Candidate | Manual/heuristic candidate | Playwright can record Tab order, but judging meaning and operability of focus order needs human review. |
| 2.4.4 | A | Link Purpose (In Context) | Partial | No | Partial/manual | axe detects empty/unnamed links and area alt issues. Contextual purpose is interpretive. |
| 2.4.5 | AA | Multiple Ways | No | Candidate | Manual/candidate | Requires site-level navigation/search/sitemap analysis and exceptions. |
| 2.4.6 | AA | Headings and Labels | No | No | Manual | Requires judging whether headings and labels describe topic or purpose. |
| 2.4.7 | AA | Focus Visible | No | Heuristic | Heuristic/manual | A11yAudit checks sequential focus stops for detectable visible indicators. It cannot prove all states or design adequacy. |
| 2.4.8 | AAA | Location | No | Candidate | Manual/candidate | Requires breadcrumb/site-location semantics and site structure review. |
| 2.4.9 | AAA | Link Purpose (Link Only) | Available/off | No | Optional automated plus manual | axe has an AAA same-purpose link rule, but link purpose still often needs content judgment. |
| 2.4.10 | AAA | Section Headings | No | No | Manual | Requires judging whether sections are organized with headings. |
| 2.4.11 | AA | Focus Not Obscured (Minimum) | No | Heuristic | Heuristic/manual | A11yAudit checks focused elements for offscreen/covered center points. Complex overlays, shadow DOM, and scroll behavior need review. |
| 2.4.12 | AAA | Focus Not Obscured (Enhanced) | No | Candidate | Candidate/manual | Existing 2.4.11 rule is not strict enough for enhanced conformance. |
| 2.4.13 | AAA | Focus Appearance | No | Candidate | Candidate/manual | Existing focus-visible rule does not measure full WCAG 2.4.13 area/contrast/thickness requirements. |
| 2.5.1 | A | Pointer Gestures | No | Candidate | Manual/candidate | Requires identifying multipoint/path gestures and alternatives. |
| 2.5.2 | A | Pointer Cancellation | No | Candidate | Manual/candidate | Playwright could test pointer down/up behavior for controls, but intent and exceptions need review. |
| 2.5.3 | A | Label in Name | Partial | Candidate | Partial/manual | axe detects some accessible-name mismatches. Visual label interpretation can need manual review. |
| 2.5.4 | A | Motion Actuation | No | Candidate | Manual/candidate | Requires detecting device-motion controls and alternatives. |
| 2.5.5 | AAA | Target Size (Enhanced) | No | Candidate | Candidate | Playwright can measure targets, but enhanced AAA threshold and exceptions are not implemented. |
| 2.5.6 | AAA | Concurrent Input Mechanisms | No | No | Manual | Requires device/input support review. |
| 2.5.7 | AA | Dragging Movements | No | Candidate | Manual/candidate | Requires identifying drag interactions and non-drag alternatives. |
| 2.5.8 | AA | Target Size (Minimum) | Yes | Candidate | Partial automated | axe has `target-size` for WCAG 2.2 AA. Manual review may still be needed for exceptions and equivalent controls. |
| 3.1.1 | A | Language of Page | Yes | No | Automated technical | axe checks `html[lang]` and validity. Correct language choice may need content review. |
| 3.1.2 | AA | Language of Parts | Partial | No | Partial/manual | axe validates language values where present. Identifying all language changes needs content review. |
| 3.1.3 | AAA | Unusual Words | No | No | Manual | Requires editorial/content review. |
| 3.1.4 | AAA | Abbreviations | No | No | Manual | Requires editorial/content review. |
| 3.1.5 | AAA | Reading Level | No | No | Manual | Requires readability/content review. |
| 3.1.6 | AAA | Pronunciation | No | No | Manual | Requires content and pronunciation context review. |
| 3.2.1 | A | On Focus | No | Candidate | Manual/candidate | Playwright can detect navigation/state changes on focus, but expected behavior and context need review. |
| 3.2.2 | A | On Input | No | Candidate | Manual/candidate | Playwright can detect changes on input, but determining user expectation and exceptions needs review. |
| 3.2.3 | AA | Consistent Navigation | No | Candidate | Manual/candidate | Requires comparing repeated navigation across multiple pages. Could be future template analysis. |
| 3.2.4 | AA | Consistent Identification | No | Candidate | Manual/candidate | Requires comparing component names/icons/actions across pages and contexts. |
| 3.2.5 | AAA | Change on Request | Available/off | Candidate | Manual/candidate | axe has an AAA meta-refresh no-exception rule. Broader change-on-request behavior is flow-dependent. |
| 3.2.6 | A | Consistent Help | No | Candidate | Manual/candidate | Requires site-level help mechanisms and order comparison. New WCAG 2.2 A criterion. |
| 3.3.1 | A | Error Identification | No | Candidate | Manual/candidate | Requires triggering validation states and judging whether errors identify fields/problems. |
| 3.3.2 | A | Labels or Instructions | Partial | Candidate | Partial/manual | axe detects some form-label issues. Whether instructions are sufficient is interpretive. |
| 3.3.3 | AA | Error Suggestion | No | Candidate | Manual/candidate | Requires triggered error states and content judgment. |
| 3.3.4 | AA | Error Prevention (Legal, Financial, Data) | No | No | Manual | Requires domain and transaction-flow review. |
| 3.3.5 | AAA | Help | No | No | Manual | Requires help availability/content review. |
| 3.3.6 | AAA | Error Prevention (All) | No | No | Manual | Requires workflow review. |
| 3.3.7 | A | Redundant Entry | No | No | Manual | Requires multi-step flow testing and user data reuse analysis. New WCAG 2.2 A criterion. |
| 3.3.8 | AA | Accessible Authentication (Minimum) | No | No | Manual | Requires authentication flow testing and cognitive-task analysis. New WCAG 2.2 AA criterion. |
| 3.3.9 | AAA | Accessible Authentication (Enhanced) | No | No | Manual | Requires authentication flow testing with stricter exceptions. New WCAG 2.2 AAA criterion. |
| 4.1.1 | Removed | Parsing (Obsolete and removed) | Available/off | No | Not a WCAG 2.2 conformance requirement | Included only for compatibility with older WCAG 2.0/2.1 reporting. axe-core deprecated rules exist but current A11yAudit config does not enable obsolete tags. |
| 4.1.2 | A | Name, Role, Value | Partial | No | Partial automated | axe detects many ARIA/name/role/value failures. Correct custom widget behavior and dynamic state updates still require interaction/manual review. |
| 4.1.3 | AA | Status Messages | No | Candidate | Manual/candidate | Requires triggering dynamic updates and verifying programmatic status exposure without focus changes. |

## Recommended Roadmap From This Matrix

### Already Shipped

- Keep axe-core as the primary static technical rule engine.
- Keep Playwright interaction rules for keyboard reachability, focus visibility, focus obstruction, and keyboard trap signals.
- Keep every custom interaction rule fixture-first.

### Best Next Automated Candidates

These have practical browser-observable behavior and should be next if we want more WCAG 2.2 technical coverage:

1. `1.4.10` Reflow
2. `1.4.12` Text Spacing
3. `1.4.13` Content on Hover or Focus
4. `2.4.3` Focus Order
5. `2.4.13` Focus Appearance
6. `2.5.1` Pointer Gestures
7. `2.5.2` Pointer Cancellation
8. `2.5.7` Dragging Movements
9. `3.2.1` On Focus
10. `3.2.2` On Input
11. `4.1.3` Status Messages

### Site-Level Template Candidates

These are not single-page DOM checks, but A11yAudit can partially support them through crawling and grouped issue analysis:

1. `2.4.5` Multiple Ways
2. `3.2.3` Consistent Navigation
3. `3.2.4` Consistent Identification
4. `3.2.6` Consistent Help

### Manual-First Areas

These should remain explicitly labeled as manual or assisted review:

- Time-based media: `1.2.x`
- Content meaning and editorial quality: `1.3.2`, `1.3.3`, `2.4.6`, `3.1.x`, `3.3.3`
- Legal, financial, data, and authentication workflows: `3.3.4`, `3.3.7`, `3.3.8`, `3.3.9`
- Full conformance process requirements and exceptions.

## Product Reporting Rule

Reports should not say "WCAG 2.2 compliant" based only on automated checks.

Recommended wording:

> A11yAudit performs automated technical checks mapped to WCAG 2.2 success criteria. Some findings are automatic violations, some are heuristic interaction signals, and many WCAG 2.2 requirements require manual review.

