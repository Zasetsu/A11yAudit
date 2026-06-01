import type { Page } from "playwright";

export interface FocusedElementSnapshot {
  selector: string | null;
  htmlSnippet: string | null;
  visibleText: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

export async function getFocusedElementSnapshot(page: Page): Promise<FocusedElementSnapshot | null> {
  return page.evaluate(() => {
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
  });
}

export async function collectTabStops(page: Page, maxStops = 80): Promise<FocusedElementSnapshot[]> {
  const stops: FocusedElementSnapshot[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < maxStops; index += 1) {
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

export async function resetFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    window.scrollTo(0, 0);
  });
}

export function selectorFromSnapshot(snapshot: FocusedElementSnapshot | null): string | null {
  return snapshot?.selector ?? null;
}
