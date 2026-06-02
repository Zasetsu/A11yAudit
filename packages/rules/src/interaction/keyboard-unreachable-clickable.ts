import type { Page } from "playwright";
import { resetFocus } from "./dom-utils.js";
import type { InteractionRule, InteractionRuleFinding } from "./types.js";

const ruleId = "keyboard-unreachable-clickable";
const title = "Clickable control is not reachable by keyboard";
const maxTabStops = 80;

interface ElementSnapshot {
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const runKeyboardUnreachableClickableRule: InteractionRule = async ({ page }) => {
  const candidates = await collectClickableCandidates(page);

  await resetFocus(page);
  const reachableSelectors = new Set((await collectReachableTabStops(page)).map((stop) => stop.selector).filter(isPresent));

  return candidates
    .filter((candidate) => candidate.selector !== null && !reachableSelectors.has(candidate.selector))
    .map((candidate) => createFinding(candidate));
};

export const keyboardUnreachableClickableRule = runKeyboardUnreachableClickableRule;

async function collectClickableCandidates(page: Page): Promise<ElementSnapshot[]> {
  return page.evaluate(() => {
    const candidateSelector = [
      "button",
      "a[href]",
      "input",
      "select",
      "textarea",
      "summary",
      '[role="button"]',
      '[role="link"]',
      "[onclick]"
    ].join(",");

    return [...document.querySelectorAll(candidateSelector)]
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .filter((element) => isVisible(element) && isClickable(element))
      .map((element) => snapshotElement(element));

    function isVisible(element: HTMLElement): boolean {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();

      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }

    function isClickable(element: HTMLElement): boolean {
      if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        return !element.disabled;
      }

      return true;
    }

    function snapshotElement(element: HTMLElement): ElementSnapshot {
      const rect = element.getBoundingClientRect();

      return {
        selector: buildSelector(element),
        htmlSnippet: element.outerHTML.slice(0, 500),
        visibleText: element.innerText?.trim().slice(0, 200) || null,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
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
        const position = hasMatchingFallbackSibling(current, tag, classes) ? `:nth-of-type(${getNthOfType(current)})` : "";

        parts.unshift(`${tag}${classes}${position}`);
        current = current.parentElement;
      }

      return parts.join(" > ");
    }

    function hasMatchingFallbackSibling(element: HTMLElement, tag: string, classes: string): boolean {
      const parent = element.parentElement;
      if (!parent) return false;

      return [...parent.children]
        .filter((sibling): sibling is HTMLElement => sibling instanceof HTMLElement && sibling !== element)
        .some((sibling) => {
          const siblingTag = sibling.tagName.toLowerCase();
          const siblingClasses = [...sibling.classList]
            .slice(0, 2)
            .map((className) => `.${CSS.escape(className)}`)
            .join("");

          return siblingTag === tag && siblingClasses === classes;
        });
    }

    function getNthOfType(element: HTMLElement): number {
      let position = 1;
      let sibling = element.previousElementSibling;

      while (sibling) {
        if (sibling.tagName === element.tagName) position += 1;
        sibling = sibling.previousElementSibling;
      }

      return position;
    }
  });
}

async function collectReachableTabStops(page: Page): Promise<ElementSnapshot[]> {
  const stops: ElementSnapshot[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < maxTabStops; index += 1) {
    await page.keyboard.press("Tab");

    const snapshot = await getFocusedElementSnapshot(page);
    if (snapshot === null) continue;

    const key = `${snapshot.selector}|${snapshot.x}|${snapshot.y}|${snapshot.width}|${snapshot.height}`;
    if (seen.has(key)) break;

    seen.add(key);
    stops.push(snapshot);
  }

  return stops;
}

async function getFocusedElementSnapshot(page: Page): Promise<ElementSnapshot | null> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body) return null;

    const rect = element.getBoundingClientRect();

    return {
      selector: buildSelector(element),
      htmlSnippet: element.outerHTML.slice(0, 500),
      visibleText: element.innerText?.trim().slice(0, 200) || null,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    };

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
        const position = hasMatchingFallbackSibling(current, tag, classes) ? `:nth-of-type(${getNthOfType(current)})` : "";

        parts.unshift(`${tag}${classes}${position}`);
        current = current.parentElement;
      }

      return parts.join(" > ");
    }

    function hasMatchingFallbackSibling(element: HTMLElement, tag: string, classes: string): boolean {
      const parent = element.parentElement;
      if (!parent) return false;

      return [...parent.children]
        .filter((sibling): sibling is HTMLElement => sibling instanceof HTMLElement && sibling !== element)
        .some((sibling) => {
          const siblingTag = sibling.tagName.toLowerCase();
          const siblingClasses = [...sibling.classList]
            .slice(0, 2)
            .map((className) => `.${CSS.escape(className)}`)
            .join("");

          return siblingTag === tag && siblingClasses === classes;
        });
    }

    function getNthOfType(element: HTMLElement): number {
      let position = 1;
      let sibling = element.previousElementSibling;

      while (sibling) {
        if (sibling.tagName === element.tagName) position += 1;
        sibling = sibling.previousElementSibling;
      }

      return position;
    }
  });
}

function createFinding(candidate: ElementSnapshot): InteractionRuleFinding {
  return {
    ruleId,
    title,
    severity: "serious",
    certainty: "automatic_violation",
    wcagCriteria: ["2.1.1"],
    description: "A visible clickable control is not reachable with sequential keyboard navigation.",
    recommendation: "Use a native interactive element, or add keyboard focus and activation support to the custom control.",
    selector: candidate.selector,
    htmlSnippet: candidate.htmlSnippet,
    visibleText: candidate.visibleText
  };
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
