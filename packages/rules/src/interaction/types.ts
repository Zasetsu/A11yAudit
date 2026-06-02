import type { FindingCertainty, Severity, Viewport } from "@a11yaudit/core";
import type { Page } from "playwright";

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
