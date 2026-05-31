import type { Severity } from "@a11yaudit/core";

const weights: Record<Severity, number> = {
  critical: 25,
  serious: 15,
  moderate: 8,
  minor: 3
};

export function calculateScore(findings: Array<{ severity: Severity }>): number {
  const penalty = findings.reduce((total, finding) => total + weights[finding.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}
