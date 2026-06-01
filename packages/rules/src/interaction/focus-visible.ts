import { resetFocus } from "./dom-utils.js";
import type { InteractionRule, InteractionRuleFinding } from "./types.js";

const ruleId = "focus-visible-missing";
const title = "Focused element has no detectable focus indicator";
const maxTabStops = 80;
const maxFindings = 5;

interface FocusIndicatorSnapshot {
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  hasFocusIndicator: boolean;
}

export const runFocusVisibleRule: InteractionRule = async ({ page }) => {
  const findings: InteractionRuleFinding[] = [];
  const seen = new Set<string>();

  await resetFocus(page);

  for (let index = 0; index < maxTabStops; index += 1) {
    await page.keyboard.press("Tab");

    const snapshot = await inspectFocusedElement(page);
    if (snapshot === null) continue;

    const key = `${snapshot.selector}|${snapshot.x}|${snapshot.y}|${snapshot.width}|${snapshot.height}`;
    if (seen.has(key)) break;

    seen.add(key);

    if (!snapshot.hasFocusIndicator) {
      findings.push(createFinding(snapshot));
    }

    if (findings.length >= maxFindings) break;
  }

  return findings;
};

export const focusVisibleRule = runFocusVisibleRule;

async function inspectFocusedElement(page: Parameters<InteractionRule>[0]["page"]): Promise<FocusIndicatorSnapshot | null> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) return null;

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return {
      selector: buildSelector(element),
      htmlSnippet: element.outerHTML.slice(0, 500),
      visibleText: element.innerText?.trim().slice(0, 200) || null,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      hasFocusIndicator: hasVisibleFocusIndicator(style)
    };

    function hasVisibleFocusIndicator(style: CSSStyleDeclaration): boolean {
      return hasVisibleOutline(style) || hasVisibleBoxShadow(style) || hasNoticeableBorder(style);
    }

    function hasVisibleOutline(style: CSSStyleDeclaration): boolean {
      return isPositiveLength(style.outlineWidth) && isVisibleLineStyle(style.outlineStyle) && isVisibleColor(style.outlineColor);
    }

    function hasVisibleBoxShadow(style: CSSStyleDeclaration): boolean {
      return style.boxShadow !== "" && style.boxShadow !== "none" && isVisibleColor(style.boxShadow);
    }

    function hasNoticeableBorder(style: CSSStyleDeclaration): boolean {
      const sides = ["Top", "Right", "Bottom", "Left"] as const;

      return sides.some((side) => {
        const width = style.getPropertyValue(`border-${side.toLowerCase()}-width`);
        const lineStyle = style.getPropertyValue(`border-${side.toLowerCase()}-style`);
        const color = style.getPropertyValue(`border-${side.toLowerCase()}-color`);

        return parseCssPixels(width) >= 2 && isVisibleLineStyle(lineStyle) && isVisibleColor(color);
      });
    }

    function isVisibleLineStyle(lineStyle: string): boolean {
      return lineStyle !== "none" && lineStyle !== "hidden";
    }

    function isPositiveLength(value: string): boolean {
      return parseCssPixels(value) > 0;
    }

    function parseCssPixels(value: string): number {
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    function isVisibleColor(value: string): boolean {
      const normalized = value.trim().toLowerCase();
      if (normalized === "" || normalized === "transparent") return false;

      return (
        !/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)/.test(normalized) &&
        !/^rgb\([^)]*\/\s*0(?:\.0+)?\s*\)/.test(normalized)
      );
    }

    function buildSelector(element: HTMLElement): string {
      if (element.id) return `#${CSS.escape(element.id)}`;

      const testId = element.getAttribute("data-testid");
      if (testId) return `[data-testid="${CSS.escape(testId)}"]`;

      const parts: string[] = [];
      let current: HTMLElement | null = element;

      while (current && current !== document.body && parts.length < 4) {
        const tag = current.tagName.toLowerCase();
        const classes = [...current.classList]
          .slice(0, 2)
          .map((className) => `.${CSS.escape(className)}`)
          .join("");

        parts.unshift(`${tag}${classes}`);
        current = current.parentElement;
      }

      return parts.join(" > ");
    }
  });
}

function createFinding(snapshot: FocusIndicatorSnapshot): InteractionRuleFinding {
  return {
    ruleId,
    title,
    severity: "serious",
    certainty: "needs_manual_verification",
    wcagCriteria: ["2.4.7"],
    description: "A sequentially focused element has no detectable outline, box-shadow, or noticeable border focus indicator.",
    recommendation: "Provide a visible focus indicator such as an outline, box-shadow, or sufficiently noticeable border on focus.",
    selector: snapshot.selector,
    htmlSnippet: snapshot.htmlSnippet,
    visibleText: snapshot.visibleText
  };
}
