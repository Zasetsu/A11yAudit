export interface WcagCriterion {
  id: string;
  name: string;
  level: "A" | "AA" | "AAA";
}

export const WCAG_22_CRITERIA: Record<string, WcagCriterion> = {
  "1.1.1": { id: "1.1.1", name: "Non-text Content", level: "A" },
  "1.3.1": { id: "1.3.1", name: "Info and Relationships", level: "A" },
  "1.4.3": { id: "1.4.3", name: "Contrast (Minimum)", level: "AA" },
  "2.4.4": { id: "2.4.4", name: "Link Purpose (In Context)", level: "A" },
  "2.4.7": { id: "2.4.7", name: "Focus Visible", level: "AA" },
  "2.4.11": { id: "2.4.11", name: "Focus Not Obscured (Minimum)", level: "AA" },
  "2.5.8": { id: "2.5.8", name: "Target Size (Minimum)", level: "AA" },
  "4.1.2": { id: "4.1.2", name: "Name, Role, Value", level: "A" }
};
