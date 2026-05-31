import type { Severity } from "@a11yaudit/core";

export function normalizeAxeImpact(impact: string | null | undefined): Severity {
  if (impact === "critical" || impact === "serious" || impact === "moderate" || impact === "minor") {
    return impact;
  }
  return "minor";
}

export function wcagTagsToCriteria(tags: string[]): string[] {
  const criteria = new Set<string>();
  for (const tag of tags) {
    const match = /^wcag(\d)(\d)(\d+)$/.exec(tag);
    if (match) criteria.add(`${match[1]}.${match[2]}.${match[3]}`);
  }
  return [...criteria].sort(compareCriteria);
}

function compareCriteria(left: string, right: string): number {
  const leftSegments = left.split(".").map(Number);
  const rightSegments = right.split(".").map(Number);

  for (let index = 0; index < Math.max(leftSegments.length, rightSegments.length); index += 1) {
    const difference = (leftSegments[index] ?? 0) - (rightSegments[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
}
