import { createHash } from "node:crypto";
import type { AuditedPage, ScanFinding, Viewport } from "@a11yaudit/core";
import { createFindingFingerprint } from "@a11yaudit/core";
import type { Result, NodeResult } from "axe-core";
import type { Page } from "playwright";
import { runAxeOnPage } from "./axe-runner.js";
import { runInteractionRules, type InteractionRuleFinding } from "./interaction/index.js";
import { normalizeAxeImpact, wcagTagsToCriteria } from "./normalize.js";

export interface AuditPageInput {
  page: Page;
  url: string;
  normalizedUrl: string;
  viewport: Viewport;
}

export interface AuditPageResult {
  page: AuditedPage;
  findings: ScanFinding[];
}

export async function auditPage(input: AuditPageInput): Promise<AuditPageResult> {
  const startedAt = Date.now();
  const results = await runAxeOnPage(input.page);
  const title = await input.page.title().catch(() => null);
  const axeFindings = results.violations.flatMap((violation) => mapViolationToFindings(violation, input));
  const interactionFindings = await runInteractionRules(input);
  const findings = [...axeFindings, ...interactionFindings.map((finding) => mapInteractionFinding(finding, input))];
  const durationMs = Date.now() - startedAt;

  return {
    page: {
      url: input.url,
      normalizedUrl: input.normalizedUrl,
      title,
      viewport: input.viewport.name,
      statusCode: null,
      finalUrl: input.page.url(),
      durationMs,
      errorMessage: null
    },
    findings
  };
}

function mapViolationToFindings(violation: Result, input: AuditPageInput): ScanFinding[] {
  const wcagCriteria = wcagTagsToCriteria(violation.tags);

  return violation.nodes.map((node) => {
    const selector = getSelector(node);
    const elementSignature = selector ?? node.html ?? "";
    const fingerprint = createFindingFingerprint({
      normalizedUrl: input.normalizedUrl,
      viewport: input.viewport.name,
      ruleId: violation.id,
      wcagCriteria,
      elementSignature
    });

    return {
      id: createStableFindingId(fingerprint),
      title: violation.help,
      severity: normalizeAxeImpact(violation.impact),
      status: "new",
      source: "axe",
      certainty: "automatic_violation",
      origin: "unknown",
      wcagCriteria,
      ruleId: violation.id,
      description: violation.description,
      recommendation: violation.help,
      pageUrl: input.url,
      viewport: input.viewport.name,
      selector,
      htmlSnippet: node.html ?? null,
      visibleText: null,
      helpUrl: violation.helpUrl,
      fingerprint,
      evidence: [],
      instances: 1
    };
  });
}

function mapInteractionFinding(finding: InteractionRuleFinding, input: AuditPageInput): ScanFinding {
  const elementSignature = finding.selector ?? finding.htmlSnippet ?? finding.title;
  const fingerprint = createFindingFingerprint({
    normalizedUrl: input.normalizedUrl,
    viewport: input.viewport.name,
    ruleId: finding.ruleId,
    wcagCriteria: finding.wcagCriteria,
    elementSignature
  });

  return {
    id: createStableFindingId(fingerprint),
    title: finding.title,
    severity: finding.severity,
    status: "new",
    source: "custom",
    certainty: finding.certainty,
    origin: "unknown",
    wcagCriteria: finding.wcagCriteria,
    ruleId: finding.ruleId,
    description: finding.description,
    recommendation: finding.recommendation,
    pageUrl: input.url,
    viewport: input.viewport.name,
    selector: finding.selector,
    htmlSnippet: finding.htmlSnippet,
    visibleText: finding.visibleText,
    helpUrl: null,
    fingerprint,
    evidence: [],
    instances: 1
  };
}

function createStableFindingId(fingerprint: string): string {
  return `finding-${createHash("sha256").update(fingerprint).digest("base64url").slice(0, 24)}`;
}

function getSelector(node: NodeResult): string | null {
  const target = node.target[0];
  return typeof target === "string" && target.length > 0 ? target : null;
}
