import { chromium, type Page } from "playwright";

export async function withPage<T>(callback: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    return await callback(page);
  } finally {
    await page.close();
    await browser.close();
  }
}
