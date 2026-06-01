import { resetFocus } from "./dom-utils.js";
import type { InteractionRule, InteractionRuleFinding } from "./types.js";

const ruleId = "focus-obscured-or-offscreen";
const title = "Focused element appears offscreen or obscured";
const maxTabStops = 80;
const maxFindings = 5;

interface FocusVisibilitySnapshot {
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  isOutsideViewport: boolean;
  isCoveredAtCenter: boolean;
}

export const runFocusObscuredRule: InteractionRule = async ({ page }) => {
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

    if (snapshot.isOutsideViewport || snapshot.isCoveredAtCenter) {
      findings.push(createFinding(snapshot));
    }

    if (findings.length >= maxFindings) break;
  }

  return findings;
};

export const focusObscuredRule = runFocusObscuredRule;

async function inspectFocusedElement(page: Parameters<InteractionRule>[0]["page"]): Promise<FocusVisibilitySnapshot | null> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) return null;

    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const isOutsideViewport =
      rect.width <= 0 ||
      rect.height <= 0 ||
      centerX < 0 ||
      centerY < 0 ||
      centerX >= window.innerWidth ||
      centerY >= window.innerHeight;

    return {
      selector: buildSelector(element),
      htmlSnippet: element.outerHTML.slice(0, 500),
      visibleText: element.innerText?.trim().slice(0, 200) || null,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      isOutsideViewport,
      isCoveredAtCenter: !isOutsideViewport && isCoveredAtCenter(element, centerX, centerY)
    };

    function isCoveredAtCenter(element: HTMLElement, centerX: number, centerY: number): boolean {
      const pointElement = document.elementFromPoint(centerX, centerY);

      return pointElement === null || (pointElement !== element && !element.contains(pointElement));
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

function createFinding(snapshot: FocusVisibilitySnapshot): InteractionRuleFinding {
  return {
    ruleId,
    title,
    severity: "serious",
    certainty: "needs_manual_verification",
    wcagCriteria: ["2.4.11"],
    description: "A sequentially focused element appears outside the viewport or covered by other page content.",
    recommendation: "Ensure focused controls are scrolled into visible space and not hidden by fixed or sticky content.",
    selector: snapshot.selector,
    htmlSnippet: snapshot.htmlSnippet,
    visibleText: snapshot.visibleText
  };
}
