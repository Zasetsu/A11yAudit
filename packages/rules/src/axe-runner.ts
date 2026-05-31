import axe from "axe-core";
import type { Page } from "playwright";

type AxeWindow = Window & {
  axe?: typeof axe;
};

export async function runAxeOnPage(page: Page): Promise<axe.AxeResults> {
  await page.addScriptTag({ content: axe.source });
  return page.evaluate(async () => {
    const axeApi = (window as AxeWindow).axe;
    if (!axeApi) {
      throw new Error("axe-core script was not loaded on the page");
    }

    return await axeApi.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]
      }
    });
  });
}
